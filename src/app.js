const { createServer } = require("http");
const { ReplicaProxy } = require("../lib");
const { Request } = require("hclientify");

process._availableProxies = [];
process._unavailableProxies = [];

for (let i = 0; i < (parseInt(process.env.REPLICA_COUNT) - 1); i++) {
  const newPorxy = new ReplicaProxy({
    url: `http://${process.env[`REPLICA_${i}_NAME`]}:${process.env[`REPLICA_${i}_PORT`]}/`,
    id: i
  });
  process._unavailableProxies.push(newPorxy);
  console.log(`~ Instantiated unavailable proxy with id: ${i}`);
}

setInterval(async () => {
  for (const proxy of process._availableProxies) {
    try {
      const testRequest = new Request(`${proxy.url.href}proxy`).timeout(500);
      const testResponse = await testRequest.send();
      if (!testResponse.statusCode || !testResponse.statusCode.toString() || testResponse.statusCode.toString()[0] !== "2") {
        const index = process._availableProxies.find(availableProxy => availableProxy.id === proxy.id);
        process._availableProxies.splice(index, 1);
        process._unavailableProxies.push(proxy);
        console.log(`- Proxy with id: ${proxy.id} became unavailable.`);
      }
      continue;
    } catch (e) {
      const index = process._availableProxies.find(availableProxy => availableProxy.id === proxy.id);
      process._availableProxies.splice(index, 1);
      process._unavailableProxies.push(proxy);
      continue;
    }
  }

  for (const proxy of process._unavailableProxies) {
    try {
        const testRequest = new Request(`${proxy.url.href}proxy`).timeout(500);
        const testResponse = await testRequest.send();
        if (testResponse.statusCode.toString()[0] === "2") {
          const index = process._unavailableProxies.find(unavailableProxy => unavailableProxy.id === proxy.id);
          process._unavailableProxies.splice(index, 1);
          process._availableProxies.push(proxy);   
          console.log(`+ Proxy with id: ${proxy.id} became available.`);
        }
        continue;
      } catch (e) {
        continue;
      }
  }
}, 1000);

let currentIndex = -1;

const proxyServer = createServer(async function (request, response) {
  if (process._availableProxies.length < 1) {
    response.writeHead(503);
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify({
      "statusCode": 503,
      "error": "Service Unavailable",
      "message": "Unable to find a sub-server to handle the request, please try again later.",
      "trace": ["load-balancer"]
    }));
  }

  currentIndex += 1;
  let proxy = process._availableProxies[currentIndex];
  if (!proxy) {
    currentIndex = 0;
    proxy = process._availableProxies[currentIndex];
  }

  proxy.server.proxyRequest(request, response);
  proxy.server.on("error", (error, request, response) => {
    response.writeHead(500);
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify({
      "statusCode": 500,
      "error": "Internal Server Error",
      "message": "An error making the sub-server unable to fulfill your request occured, please try again later.",
      "trace": ["load-balancer"]
    }));
  });
});

proxyServer.listen(parseInt(process.env.PROXY_PORT));
console.log(`Proxy started on port ${parseInt(process.env.PROXY_PORT)}`);