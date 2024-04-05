// @bun
// src/index.ts
var join = function(s, separator = "|") {
  if (Array.isArray(s))
    return s.join(separator);
  return String(s);
};
var getSID = function(cookies) {
  let match = (cookies || []).join("").match(/SID=([^;]*)/);
  return match ? match[1] : null;
};
var escape = encodeURIComponent;

class qBittorrentClientError extends Error {
  constructor() {
    super(...arguments);
  }
  statusCode;
  url;
}

class qBittorrentClient {
  #url;
  #username;
  #password;
  #SID = "";
  auth;
  app;
  log;
  sync;
  transfer;
  torrents;
  search;
  constructor(url, username = "", password = "") {
    this.#url = url.replace(/\/$/, "");
    this.#username = username;
    this.#password = password;
    this.auth = new qBittorrentAuthClient(this);
    this.app = new qBittorrentAppClient(this);
    this.log = new qBittorrentLogClient(this);
    this.sync = new qBittorrentSyncClient(this);
    this.transfer = new qBittorrentTransferClient(this);
    this.torrents = new qBittorrentTorrentsClient(this);
    this.search = new qBittorrentSearchClient(this);
  }
  async request(method, data) {
    if (!this.#SID && method !== "/auth/login") {
      await this.auth.login(this.#username, this.#password);
      if (!this.#SID) {
        throw Error("unable to get session id");
      }
    }
    const url = this.#url + "/api/v2/" + method.replace(/^\//, "");
    let formData = new FormData;
    for (const [key, val] of Object.entries(data || {})) {
      formData.append(key, val);
    }
    const response = await fetch(url, {
      method: "POST",
      body: data ? formData : null,
      headers: {
        cookie: `SID=${this.#SID}`
      }
    });
    if (response.status !== 200) {
      const error = new qBittorrentClientError(`${response.status} ${response.body}`);
      error.statusCode = response.status;
      error.url = url;
      throw error;
    }
    const sid = getSID(response.headers.getSetCookie());
    if (sid) {
      this.#SID = sid;
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }
}

class qBittorrentSubClient {
  client;
  constructor(client) {
    this.client = client;
  }
}

class qBittorrentAuthClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  login(username, password) {
    return this.client.request("/auth/login", { username, password });
  }
  logout() {
    return this.client.request("/auth/logout");
  }
}

class qBittorrentAppClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  version() {
    return this.client.request("/app/version");
  }
  webapiVersion() {
    return this.client.request("/app/webapiVersion");
  }
  buildInfo() {
    return this.client.request("/app/buildInfo");
  }
  shutdown() {
    return this.client.request("/app/shutdown");
  }
  preferences() {
    return this.client.request("/app/preferences");
  }
  setPreferences(prefs) {
    return this.client.request("/app/setPreferences", {
      json: JSON.stringify(prefs)
    });
  }
  defaultSavePath() {
    return this.client.request("/app/defaultSavePath");
  }
}

class qBittorrentLogClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  main(params) {
    return this.client.request("/log/main", params);
  }
  peers(last_known_id = -1) {
    return this.client.request("/log/peers", { last_known_id });
  }
}

class qBittorrentSyncClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  maindata(rid = 0) {
    return this.client.request("/sync/maindata", { rid });
  }
  torrentPeers(hash, rid = 0) {
    return this.client.request("/sync/torrentPeers", { hash, rid });
  }
}

class qBittorrentTransferClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  info() {
    return this.client.request("/transfer/info");
  }
  speedLimitsMode() {
    return this.client.request("/transfer/speedLimitsMode");
  }
  toggleSpeedLimitsMode() {
    return this.client.request("/transfer/toggleSpeedLimitsMode");
  }
  downloadLimit() {
    return this.client.request("/transfer/downloadLimit");
  }
  setDownloadLimit(limit) {
    return this.client.request("/transfer/setDownloadLimit", { limit });
  }
  uploadLimit() {
    return this.client.request("/transfer/uploadLimit");
  }
  setUploadLimit(limit) {
    return this.client.request("/transfer/setUploadLimit", { limit });
  }
  banPeers(peers) {
    return this.client.request("/transfer/banPeers", { peers: join(peers) });
  }
}

class qBittorrentTorrentsClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  info(params = {}) {
    const data = {};
    for (const [key, value] of Object.entries(params)) {
      switch (key) {
        case "category":
        case "tag":
          data[key] = escape(String(value));
          break;
        case "hashes":
          data[key] = Array.isArray(value) ? join(value) : value;
          break;
      }
    }
    return this.client.request("/torrents/info", data);
  }
  properties(hash) {
    return this.client.request("/torrents/properties", { hash });
  }
  trackers(hash) {
    return this.client.request("/torrents/trackers", { hash });
  }
  webseeds(hash) {
    return this.client.request("/torrents/webseeds", { hash });
  }
  files(hash, indexes) {
    return this.client.request("/torrents/files", {
      hash,
      ...indexes !== undefined && { indexes: join(indexes) }
    });
  }
  pieceStates(hash) {
    return this.client.request("/torrents/pieceStates", { hash });
  }
  pieceHashes(hash) {
    return this.client.request("/torrents/pieceHashes", { hash });
  }
  pause(hashes) {
    return this.client.request("/torrents/pause", { hashes: join(hashes) });
  }
  resume(hashes) {
    return this.client.request("/torrents/resume", { hashes: join(hashes) });
  }
  delete(hashes, deleteFiles = false) {
    return this.client.request("/torrents/delete", {
      hashes: join(hashes),
      deleteFiles
    });
  }
  recheck(hashes) {
    return this.client.request("/torrents/recheck", { hashes: join(hashes) });
  }
  reannounce(hashes) {
    return this.client.request("/torrents/reannounce", {
      hashes: join(hashes)
    });
  }
  editTracker(hash, origUrl, newUrl) {
    return this.client.request("/torrents/editTracker", {
      hash,
      origUrl,
      newUrl
    });
  }
  removeTracker(hash, urls) {
    return this.client.request("/torrents/removeTracker", {
      hash,
      urls: join(urls)
    });
  }
  addPeers(hashes, peers) {
    return this.client.request("/torrents/addPeers", {
      hashes: join(hashes),
      peers: join(peers)
    });
  }
  increasePrio(hashes) {
    return this.client.request("/torrents/increasePrio", {
      hashes: join(hashes)
    });
  }
  decreasePrio(hashes) {
    return this.client.request("/torrents/decreasePrio", {
      hashes: join(hashes)
    });
  }
  topPrio(hashes) {
    return this.client.request("/torrents/topPrio", { hashes: join(hashes) });
  }
  bottomPrio(hashes) {
    return this.client.request("/torrents/bottomPrio", {
      hashes: join(hashes)
    });
  }
  filePrio(hash, id, priority) {
    return this.client.request("/torrents/filePrio", {
      hash,
      id: join(id),
      priority
    });
  }
  downloadLimit(hashes) {
    return this.client.request("/torrents/downloadLimit", {
      hashes: join(hashes)
    });
  }
  setDownloadLimit(hashes, limit) {
    return this.client.request("/torrents/setDownloadLimit", {
      hashes: join(hashes),
      limit
    });
  }
  setShareLimits(hashes, ratioLimit = -1, seedingTimeLimit = -1) {
    return this.client.request("/torrents/setShareLimits", {
      hashes: join(hashes),
      ratioLimit,
      seedingTimeLimit
    });
  }
  uploadLimit(hashes) {
    return this.client.request("/torrents/uploadLimit", {
      hashes: join(hashes)
    });
  }
  setUploadLimit(hashes, limit) {
    return this.client.request("/torrents/setUploadLimit", {
      hashes: join(hashes),
      limit
    });
  }
  setLocation(hashes, location) {
    return this.client.request("/torrents/setLocation", {
      hashes: join(hashes),
      location
    });
  }
  rename(hash, name) {
    return this.client.request("/torrents/rename", { hash, name });
  }
  setCategory(hashes, category) {
    return this.client.request("/torrents/setCategory", {
      hashes: join(hashes),
      category
    });
  }
  categories() {
    return this.client.request("/torrents/categories");
  }
  createCategory(category, savePath) {
    return this.client.request("/torrents/createCategory", {
      category,
      savePath
    });
  }
  editCategory(category, savePath) {
    return this.client.request("/torrents/editCategory", {
      category,
      savePath
    });
  }
  removeCategories(categories) {
    return this.client.request("/torrents/removeCategories", {
      categories: join(categories, "%0A")
    });
  }
  addTags(hashes, tags) {
    return this.client.request("/torrents/addTags", {
      hashes: join(hashes),
      tags: join(tags, ",")
    });
  }
  removeTags(hashes, tags) {
    return this.client.request("/torrents/removeTags", {
      hashes: join(hashes),
      tags: join(tags, ",")
    });
  }
  tags() {
    return this.client.request("/torrents/tags");
  }
  createTags(tags) {
    return this.client.request("/torrents/createTags", {
      tags: join(tags, ",")
    });
  }
  deleteTags(tags) {
    return this.client.request("/torrents/deleteTags", {
      tags: join(tags, ",")
    });
  }
  setAutoManagement(hashes, enable = false) {
    return this.client.request("/torrents/setAutoManagement", {
      hashes: join(hashes),
      enable
    });
  }
  toggleSequentialDownload(hashes) {
    return this.client.request("/torrents/toggleSequentialDownload", {
      hashes: join(hashes)
    });
  }
  toggleFirstLastPiecePrio(hashes) {
    return this.client.request("/torrents/toggleFirstLastPiecePrio", {
      hashes: join(hashes)
    });
  }
  setForceStart(hashes, value = false) {
    return this.client.request("/torrents/setForceStart", {
      hashes: join(hashes),
      value
    });
  }
  setSuperSeeding(hashes, value = false) {
    return this.client.request("/torrents/setSuperSeeding", {
      hashes: join(hashes),
      value
    });
  }
  renameFile(hash, oldPath, newPath) {
    return this.client.request("/torrents/renameFile", {
      hash,
      oldPath,
      newPath
    });
  }
  renameFolder(hash, oldPath, newPath) {
    return this.client.request("/torrents/renameFolder", {
      hash,
      oldPath,
      newPath
    });
  }
  add(torrent) {
    const data = {};
    if (typeof torrent === "string" || Array.isArray(torrent)) {
      data.urls = join(torrent, "\n");
    } else {
      if (torrent?.urls) {
        data.urls = join(torrent.urls, "\n");
      }
      if (torrent?.torrents) {
        const torrents = Array.isArray(torrent.torrents) ? torrent.torrents : [torrent.torrents];
        data.torrents = torrents.map((torrent2) => {
          torrent2.content_type = "application/x-bittorrent";
          return torrent2;
        });
      }
      if (torrent?.tags) {
        data.tags = join(torrent.tags, ",");
      }
      for (const key of [
        "savepath",
        "cookie",
        "category",
        "skip_checking",
        "paused",
        "root_folder",
        "rename",
        "upLimit",
        "dlLimit",
        "ratioLimit",
        "seedingTimeLimit",
        "autoTMM",
        "sequentialDownload",
        "firstLastPiecePrio"
      ]) {
        if (key in torrent) {
          data[key] = torrent[key];
        }
      }
      data.dummy = "true";
    }
    return this.client.request("/torrents/add", data);
  }
}

class qBittorrentSearchClient extends qBittorrentSubClient {
  constructor() {
    super(...arguments);
  }
  async start(pattern, plugins = "all", category = "all") {
    const { id } = await this.client.request("/search/start", {
      pattern,
      plugins: join(plugins),
      category: join(category)
    });
    return id;
  }
  stop(id) {
    return this.client.request("/search/stop", { id });
  }
  async status(id) {
    const res = await this.client.request("/search/status", {
      id: typeof id === "number" ? id : undefined
    });
    if (typeof id === "number") {
      return res[0];
    }
    return res;
  }
  async results(id, limit = 0, offset = 0) {
    return (await this.client.request("/search/results", { id, limit, offset })).results;
  }
  delete(id) {
    return this.client.request("/search/delete", { id });
  }
  plugins() {
    return this.client.request("/search/plugins");
  }
  installPlugin(sources) {
    return this.client.request("/search/installPlugin", {
      sources: join(sources)
    });
  }
  uninstallPlugin(names) {
    return this.client.request("/search/uninstallPlugin", {
      names: join(names)
    });
  }
  enablePlugin(names, enable) {
    return this.client.request("/search/enablePlugin", {
      names: join(names),
      enable
    });
  }
  updatePlugins() {
    return this.client.request("/search/updatePlugins");
  }
}
export {
  qBittorrentClient
};
