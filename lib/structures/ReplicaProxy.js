const { URL } = require("url");
const { createProxyServer } = require("http-proxy");

class ReplicaProxy {
  constructor ({ url, id }) {
    this.id = id;
    this.url = new URL(url);
    this.server = createProxyServer({
      target: {
        host: this.url.host,
        port: this.url.port
      }
    });
  }
}

module.exports = ReplicaProxy;