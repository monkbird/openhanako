const os = require("os");
const path = require("path");
const fs = require("fs");

const PI_SDK_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

function expandHome(input, homeDir = os.homedir()) {
  if (!input) return input;
  if (input === "~") return homeDir;
  if (input.startsWith("~/") || input.startsWith("~" + path.sep)) {
    return path.join(homeDir, input.slice(2));
  }
  return input;
}

function resolveHanakoHome(input, homeDir = os.homedir()) {
  const raw = input || path.join(homeDir, ".hanako");
  return path.resolve(expandHome(raw, homeDir));
}

function resolveHanaPiRoot(hanakoHome) {
  if (!hanakoHome || typeof hanakoHome !== "string") {
    throw new Error("resolveHanaPiRoot: hanakoHome is required");
  }
  return path.join(hanakoHome, ".pi");
}

function resolveHanaPiAgentDir(hanakoHome) {
  return path.join(resolveHanaPiRoot(hanakoHome), "agent");
}

function resolveHanaPiProjectDir(hanakoHome) {
  return path.join(resolveHanaPiRoot(hanakoHome), "project");
}

/**
 * 检测本地代理设置
 * 优先级：环境变量 > Clash for Windows 默认配置
 */
function detectProxyEnv() {
  const proxyVars = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"];
  for (const v of proxyVars) {
    if (process.env[v]) return { name: v, value: process.env[v] };
  }
  // 检测 Clash for Windows 配置中的 mixed-port
  try {
    const clashConfigPath = path.join(os.homedir(), ".config", "clash", "config.yaml");
    if (fs.existsSync(clashConfigPath)) {
      const content = fs.readFileSync(clashConfigPath, "utf8");
      const match = content.match(/mixed-port:\s*(\d+)/);
      if (match) {
        const port = parseInt(match[1], 10);
        return { name: "HTTPS_PROXY", value: `http://127.0.0.1:${port}` };
      }
    }
  } catch { /* ignore */ }
  return null;
}

function withHanaPiSdkEnv(env, hanakoHome) {
  const detected = detectProxyEnv();
  const proxyEntry = detected ? { [detected.name]: detected.value } : {};
  return {
    ...env,
    ...proxyEntry,
    [PI_SDK_AGENT_DIR_ENV]: resolveHanaPiAgentDir(hanakoHome),
    // OAuth callback server 默认绑定 127.0.0.1（仅 IPv4），但 Windows 上
    // localhost 优先解析为 IPv6 ::1，导致浏览器回调无法到达。显式指定
    // localhost 让 Node.js 同时处理 IPv4 和 IPv6 连接。
    PI_OAUTH_CALLBACK_HOST: "localhost",
  };
}

function ensureHanaPiSdkDirs(hanakoHome) {
  fs.mkdirSync(resolveHanaPiAgentDir(hanakoHome), { recursive: true });
  fs.mkdirSync(resolveHanaPiProjectDir(hanakoHome), { recursive: true });
}

function configureProcessPiSdkEnv(hanakoHome, env = process.env) {
  const agentDir = resolveHanaPiAgentDir(hanakoHome);
  env[PI_SDK_AGENT_DIR_ENV] = agentDir;
  return agentDir;
}

module.exports = {
  PI_SDK_AGENT_DIR_ENV,
  configureProcessPiSdkEnv,
  ensureHanaPiSdkDirs,
  resolveHanakoHome,
  resolveHanaPiAgentDir,
  resolveHanaPiProjectDir,
  resolveHanaPiRoot,
  withHanaPiSdkEnv,
};
