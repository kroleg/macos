#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");
const readline = require("readline");

const CLAUDE_DIR = path.join(require("os").homedir(), ".claude");
const HISTORY_FILE = path.join(CLAUDE_DIR, "history.jsonl");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const PORT = process.env.PORT || 7890;

// --- History index (loaded once at startup, refreshed on demand) ---

let historyIndex = []; // [{display, timestamp, project, sessionId}]
let historyMtime = 0;

function loadHistory() {
  try {
    const stat = fs.statSync(HISTORY_FILE);
    if (stat.mtimeMs === historyMtime && historyIndex.length > 0) return;
    historyMtime = stat.mtimeMs;
  } catch {
    return;
  }

  const raw = fs.readFileSync(HISTORY_FILE, "utf8");
  const seen = new Map(); // sessionId -> entry (deduplicate, keep first per session+display)
  const entries = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const key = `${obj.sessionId}::${obj.display}::${obj.timestamp}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      entries.push({
        display: obj.display || "",
        timestamp: obj.timestamp,
        project: obj.project || "",
        sessionId: obj.sessionId || "",
      });
    } catch {}
  }

  historyIndex = entries;
}

// --- Session name index (slug + customTitle from session JSONL files) ---

let nameIndex = new Map(); // sessionId -> { slug, customTitle, projectDir, project }
let nameIndexBuilt = false;
let nameIndexBuildPromise = null;

function buildNameIndex() {
  if (nameIndexBuildPromise) return nameIndexBuildPromise;
  if (nameIndexBuilt) return Promise.resolve();

  nameIndexBuildPromise = new Promise((resolve) => {
    const index = new Map();
    let projectDirs;
    try {
      projectDirs = fs.readdirSync(PROJECTS_DIR);
    } catch {
      nameIndexBuilt = true;
      nameIndexBuildPromise = null;
      resolve();
      return;
    }

    let pending = 0;
    let started = false;

    for (const projDir of projectDirs) {
      const projPath = path.join(PROJECTS_DIR, projDir);
      let files;
      try {
        files = fs.readdirSync(projPath);
      } catch {
        continue;
      }

      for (const f of files) {
        if (!f.endsWith(".jsonl") || f.includes("subagent")) continue;
        const sessionId = f.replace(".jsonl", "");
        const filePath = path.join(projPath, f);
        pending++;

        // Stream-read for efficiency — only need slug and custom-title lines
        const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
        let slug = null;
        let customTitle = null;

        rl.on("line", (line) => {
          if (slug && customTitle) { rl.close(); return; }
          if (!slug && line.includes('"slug"')) {
            const m = line.match(/"slug":"([^"]+)"/);
            if (m) slug = m[1];
          }
          if (!customTitle && line.includes('"custom-title"')) {
            try {
              const obj = JSON.parse(line);
              if (obj.type === "custom-title" && obj.customTitle) customTitle = obj.customTitle;
            } catch {}
          }
        });

        rl.on("close", () => {
          if (slug || customTitle) {
            const project = projDir.replace(/-/g, "/").replace(/^\//, "");
            index.set(sessionId, { slug, customTitle, projectDir: projDir, project });
          }
          pending--;
          if (started && pending === 0) {
            nameIndex = index;
            nameIndexBuilt = true;
            nameIndexBuildPromise = null;
            resolve();
          }
        });
      }
    }

    started = true;
    if (pending === 0) {
      nameIndex = index;
      nameIndexBuilt = true;
      nameIndexBuildPromise = null;
      resolve();
    }
  });

  return nameIndexBuildPromise;
}

function refreshNameIndex() {
  nameIndexBuilt = false;
  nameIndexBuildPromise = null;
  return buildNameIndex();
}

async function searchByName(query) {
  await buildNameIndex();
  loadHistory();
  const { include, exclude } = parseQuery(query);

  const results = [];
  for (const [sessionId, info] of nameIndex) {
    const searchable = `${info.slug || ""} ${info.customTitle || ""}`.toLowerCase();
    if (include.length && !include.every((t) => searchable.includes(t))) continue;
    if (exclude.some((t) => searchable.includes(t))) continue;

    // Enrich with history prompts
    const prompts = [];
    let firstTs = null;
    let lastTs = null;
    let project = info.project;

    for (const entry of historyIndex) {
      if (entry.sessionId !== sessionId) continue;
      if (entry.project) project = entry.project;
      prompts.push({ display: entry.display, timestamp: entry.timestamp });
      if (!firstTs || entry.timestamp < firstTs) firstTs = entry.timestamp;
      if (!lastTs || entry.timestamp > lastTs) lastTs = entry.timestamp;
    }

    results.push({
      sessionId,
      projectDir: info.projectDir,
      project,
      slug: info.slug,
      customTitle: info.customTitle,
      prompts: prompts.slice(0, 4),
      firstTimestamp: firstTs,
      lastTimestamp: lastTs,
    });
  }

  results.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  return results.slice(0, 200);
}

// --- Session listing (discover all session files) ---

function listSessions() {
  const sessions = [];
  let projectDirs;
  try {
    projectDirs = fs.readdirSync(PROJECTS_DIR);
  } catch {
    return sessions;
  }

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir);
    let files;
    try {
      files = fs.readdirSync(projPath);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.endsWith(".jsonl")) {
        const sessionId = f.replace(".jsonl", "");
        sessions.push({ projectDir: projDir, sessionId, file: path.join(projPath, f) });
      }
    }
  }
  return sessions;
}

// --- Search through history prompts ---

function parseQuery(query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const include = [];
  const exclude = [];
  for (const t of tokens) {
    if (t.startsWith("-") && t.length > 1) exclude.push(t.slice(1));
    else include.push(t);
  }
  return { include, exclude };
}

function searchHistory(query) {
  loadHistory();
  const { include, exclude } = parseQuery(query);

  // Group by session, collect matching prompts
  const sessionMap = new Map();

  for (const entry of historyIndex) {
    const text = entry.display.toLowerCase();
    if (include.length && !include.every((t) => text.includes(t))) continue;
    if (exclude.some((t) => text.includes(t))) continue;

    if (!sessionMap.has(entry.sessionId)) {
      sessionMap.set(entry.sessionId, {
        sessionId: entry.sessionId,
        project: entry.project,
        prompts: [],
        firstTimestamp: entry.timestamp,
        lastTimestamp: entry.timestamp,
      });
    }
    const s = sessionMap.get(entry.sessionId);
    s.prompts.push({ display: entry.display, timestamp: entry.timestamp });
    if (entry.timestamp < s.firstTimestamp) s.firstTimestamp = entry.timestamp;
    if (entry.timestamp > s.lastTimestamp) s.lastTimestamp = entry.timestamp;
  }

  const results = [...sessionMap.values()];
  results.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  return results.slice(0, 200);
}

// --- Full-text search through session files using ripgrep ---

function searchFullText(query, limit = 50) {
  return new Promise((resolve) => {
    const { include, exclude } = parseQuery(query);
    if (!include.length) { resolve([]); return; }

    // Use ripgrep for speed across 560MB of data
    const searchPattern = include.join(".*");
    const args = [
      "--json",
      "-i",
      "--max-count=3", // max matches per file
      "-g",
      "*.jsonl",
      searchPattern,
      PROJECTS_DIR,
    ];

    execFile("rg", args, { maxBuffer: 50 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
      const sessionMap = new Map();

      if (stdout) {
        for (const line of stdout.split("\n")) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type !== "match") continue;
            const filePath = obj.data?.path?.text || "";
            const matchText = obj.data?.lines?.text || "";

            // Extract project dir and session ID from path
            const rel = path.relative(PROJECTS_DIR, filePath);
            const parts = rel.split(path.sep);
            if (parts.length < 2) continue;
            const projectDir = parts[0];
            const sessionId = parts[1].replace(".jsonl", "");

            // Try to parse the matched line to get message context
            let snippet = "";
            let msgType = "";
            let timestamp = "";
            try {
              const msg = JSON.parse(matchText);
              msgType = msg.type || "";
              timestamp = msg.timestamp || "";
              if (typeof msg.content === "string") {
                snippet = msg.content.substring(0, 300);
              } else if (msg.message?.content) {
                const c = msg.message.content;
                if (typeof c === "string") snippet = c.substring(0, 300);
                else if (Array.isArray(c)) {
                  const textBlock = c.find((b) => b.type === "text");
                  if (textBlock) snippet = textBlock.text.substring(0, 300);
                }
              }
            } catch {
              snippet = matchText.substring(0, 300);
            }

            // Post-filter: skip if snippet contains excluded terms
            const snippetLower = snippet.toLowerCase() + matchText.toLowerCase();
            if (exclude.some((t) => snippetLower.includes(t))) continue;

            const key = `${projectDir}/${sessionId}`;
            if (!sessionMap.has(key)) {
              sessionMap.set(key, {
                sessionId,
                projectDir,
                project: projectDir.replace(/-/g, "/").replace(/^\//, ""),
                matches: [],
              });
            }
            sessionMap.get(key).matches.push({ snippet, msgType, timestamp });
          } catch {}
        }
      }

      const results = [...sessionMap.values()].slice(0, limit);
      resolve(results);
    });
  });
}

// --- Load a single session ---

function loadSession(projectDir, sessionId) {
  const filePath = path.join(PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const messages = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      messages.push(obj);
    } catch {}
  }

  return messages;
}

// --- Get all unique projects from history ---

function getProjects() {
  loadHistory();
  const projects = new Set();
  for (const entry of historyIndex) {
    if (entry.project) projects.add(entry.project);
  }
  return [...projects].sort();
}

// --- Get sessions for a project (from history) ---

function getProjectSessions(project) {
  loadHistory();
  const sessionMap = new Map();

  for (const entry of historyIndex) {
    if (entry.project !== project) continue;
    if (!sessionMap.has(entry.sessionId)) {
      sessionMap.set(entry.sessionId, {
        sessionId: entry.sessionId,
        project: entry.project,
        prompts: [],
        firstTimestamp: entry.timestamp,
        lastTimestamp: entry.timestamp,
      });
    }
    const s = sessionMap.get(entry.sessionId);
    s.prompts.push({ display: entry.display, timestamp: entry.timestamp });
    if (entry.timestamp < s.firstTimestamp) s.firstTimestamp = entry.timestamp;
    if (entry.timestamp > s.lastTimestamp) s.lastTimestamp = entry.timestamp;
  }

  const results = [...sessionMap.values()];
  results.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  return results;
}

// --- Find the project dir for a given session ID ---

function findSessionProjectDir(sessionId) {
  let projectDirs;
  try {
    projectDirs = fs.readdirSync(PROJECTS_DIR);
  } catch {
    return null;
  }

  for (const projDir of projectDirs) {
    const filePath = path.join(PROJECTS_DIR, projDir, `${sessionId}.jsonl`);
    if (fs.existsSync(filePath)) return projDir;
  }
  return null;
}

// --- Get project path for a session ID ---

function getSessionProject(sessionId) {
  loadHistory();
  for (const entry of historyIndex) {
    if (entry.sessionId === sessionId && entry.project) return entry.project;
  }
  return null;
}

// --- Active sessions ---

function getActiveSessions() {
  return new Promise((resolve) => {
    // Step 1: Find running claude processes
    execFile("ps", ["-eo", "pid,lstart,command"], (err, stdout) => {
      const processes = [];
      if (stdout) {
        for (const line of stdout.split("\n")) {
          const match = line.match(/^\s*(\d+)\s+(.+?)\s+(claude\s+.*)$/);
          if (!match) continue;
          const [, pid, lstart, cmd] = match;
          // Skip helper processes (deno, shell snapshots, grep)
          if (!cmd.startsWith("claude ")) continue;
          const resumeMatch = cmd.match(/--resume\s+([0-9a-f-]+)/);
          processes.push({
            pid: parseInt(pid),
            startedAt: new Date(lstart).toISOString(),
            command: cmd.trim(),
            sessionId: resumeMatch ? resumeMatch[1] : null,
          });
        }
      }

      // Step 2: Find recently modified session files (last 10 min)
      execFile(
        "find",
        [PROJECTS_DIR, "-name", "*.jsonl", "-maxdepth", 2, "-mmin", "-10"],
        (err2, stdout2) => {
          const recentFiles = new Set();
          if (stdout2) {
            for (const f of stdout2.trim().split("\n")) {
              if (!f) continue;
              const base = path.basename(f, ".jsonl");
              // Skip subagent files
              if (f.includes("/subagents/")) continue;
              recentFiles.add(base);
            }
          }

          // Step 3: Merge - active = has a process OR recently modified file
          loadHistory();
          const sessionMap = new Map();

          // Add process-based sessions
          for (const proc of processes) {
            if (proc.sessionId && !sessionMap.has(proc.sessionId)) {
              sessionMap.set(proc.sessionId, { pid: proc.pid, startedAt: proc.startedAt, command: proc.command });
            }
          }

          // Add recently-active file-based sessions
          for (const sid of recentFiles) {
            if (!sessionMap.has(sid)) {
              sessionMap.set(sid, { pid: null, startedAt: null, command: null });
            }
          }

          // Enrich with history data
          const results = [];
          for (const [sessionId, info] of sessionMap) {
            const prompts = [];
            let project = null;
            let firstTs = null;
            let lastTs = null;

            for (const entry of historyIndex) {
              if (entry.sessionId !== sessionId) continue;
              if (!project) project = entry.project;
              prompts.push({ display: entry.display, timestamp: entry.timestamp });
              if (!firstTs || entry.timestamp < firstTs) firstTs = entry.timestamp;
              if (!lastTs || entry.timestamp > lastTs) lastTs = entry.timestamp;
            }

            // Find the project dir for this session
            const projectDir = findSessionProjectDir(sessionId);

            results.push({
              sessionId,
              project,
              projectDir,
              pid: info.pid,
              startedAt: info.startedAt,
              command: info.command,
              prompts: prompts.slice(-5), // last 5 prompts
              firstTimestamp: firstTs,
              lastTimestamp: lastTs,
              hasProcess: !!info.pid,
            });
          }

          // Sort: running processes first, then by last activity
          results.sort((a, b) => {
            if (a.hasProcess && !b.hasProcess) return -1;
            if (!a.hasProcess && b.hasProcess) return 1;
            return (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
          });

          resolve(results);
        }
      );
    });
  });
}

// --- Open session in app ---

function escapeForAppleScript(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Copy text to macOS clipboard, then run callback
function copyToClipboard(text, cb) {
  const proc = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "ignore"] });
  proc.stdin.write(text);
  proc.stdin.end();
  proc.on("close", () => cb && cb());
}

// Use clipboard + paste instead of keystroke for reliability
function typeViaClipboard(processName, text, andPressEnter) {
  const enter = andPressEnter ? '\n        key code 36' : '';
  const script = `
    tell application "System Events"
      tell process "${processName}"
        keystroke "v" using command down
        delay 0.1${enter}
      end tell
    end tell
  `;
  const child = spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
  child.unref();
}

function openInGhostty(sessionId, project) {
  const cmd = project
    ? `cd '${project}' && claude --resume ${sessionId}`
    : `claude --resume ${sessionId}`;

  const script = `
    tell application "Ghostty"
      activate
    end tell
    delay 0.3
    tell application "System Events"
      tell process "Ghostty"
        keystroke "n" using command down
      end tell
    end tell
  `;

  copyToClipboard(cmd, () => {
    const child = spawn("osascript", ["-e", script]);
    child.on("close", () => {
      setTimeout(() => typeViaClipboard("Ghostty", cmd, true), 400);
    });
  });
}

function openInVSCode(sessionId, project) {
  const cmd = `claude --resume ${sessionId}`;

  if (project) {
    const child = spawn("code", [project], { detached: true, stdio: "ignore" });
    child.unref();
  }

  copyToClipboard(cmd, () => {});
  // Return "copied" so the frontend can show a notification
  return "copied";
}

// --- HTTP Server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");

  // API routes
  if (url.pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    const mode = url.searchParams.get("mode") || "prompts";

    res.setHeader("Content-Type", "application/json");
    if (mode === "fulltext") {
      const results = await searchFullText(q);
      res.end(JSON.stringify(results));
    } else if (mode === "names") {
      const results = await searchByName(q);
      res.end(JSON.stringify(results));
    } else {
      const results = searchHistory(q);
      res.end(JSON.stringify(results));
    }
    return;
  }

  if (url.pathname === "/api/active") {
    res.setHeader("Content-Type", "application/json");
    const results = await getActiveSessions();
    res.end(JSON.stringify(results));
    return;
  }

  if (url.pathname === "/api/projects") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getProjects()));
    return;
  }

  if (url.pathname.startsWith("/api/project-sessions")) {
    const project = url.searchParams.get("project") || "";
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getProjectSessions(project)));
    return;
  }

  if (url.pathname.startsWith("/api/session/")) {
    const parts = url.pathname.replace("/api/session/", "").split("/");
    // Could be /api/session/<sessionId> or /api/session/<projectDir>/<sessionId>
    let projectDir, sessionId;
    if (parts.length === 1) {
      sessionId = parts[0];
      projectDir = findSessionProjectDir(sessionId);
    } else {
      projectDir = parts.slice(0, -1).join("/");
      sessionId = parts[parts.length - 1];
    }

    if (!projectDir) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    const messages = loadSession(projectDir, sessionId);
    if (!messages) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ projectDir, sessionId, messages }));
    return;
  }

  if (url.pathname === "/api/open") {
    const sessionId = url.searchParams.get("session") || "";
    const app = url.searchParams.get("app") || "ghostty";

    if (!sessionId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Missing session param" }));
      return;
    }

    const project = getSessionProject(sessionId);
    res.setHeader("Content-Type", "application/json");

    if (app === "vscode") {
      openInVSCode(sessionId, project);
      res.end(JSON.stringify({ ok: true, app: "vscode", project, notify: "Resume command copied — paste in terminal" }));
    } else {
      openInGhostty(sessionId, project);
      res.end(JSON.stringify({ ok: true, app: "ghostty", project }));
    }
    return;
  }

  // Serve the HTML UI
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const htmlPath = path.join(__dirname, "index.html");
    res.setHeader("Content-Type", "text/html");
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Claude Session Search running at http://localhost:${PORT}`);
  // Pre-build name index in background
  buildNameIndex().then(() => {
    console.log(`Name index: ${nameIndex.size} sessions with names`);
  });
});
