/*
 * Created on Sat Dec 11 2021
 * Authored by zonebond
 * @github - github.com/zonebond
 * @e-mail - zonebond@126.com
 */
import chalk from 'chalk'
import http from 'http'
import { join } from 'path'

const GAP = (text, size = 59, sign = ' ') => {
  if(!text) return [...new Array(size + 2)].join(sign);
  
  const max = Math.max(text.length, size) + 2;
  const idx = Math.ceil((max - text.length) * 0.5);
  const ___ = [...new Array(max)].join(sign);
  return [___.substring(0, idx), text, ___.substring(idx + text.length)].join('');
};

export default async function DevServer(esbuild, serve, settings) {
  const { proxy, ...others } = serve || { port: 3000 };
  const server = await esbuild.serve(others, settings);
  const { host, port } = server;

  const PROXY = Object.keys(proxy).map(p => {
    const { target, stream } = typeof proxy[p] === 'string' 
        ? { target: proxy[p] } 
        : proxy[p];
    return { RULE: new RegExp(`^${p}`), UPSTREAM: { target: new URL(target), stream } };
  });

  // console.log('PROXY', PROXY);

  http.createServer((req, res) => {

    const options = PROXY_MAPPING({
      hostname: host,
      port: port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    }, PROXY);

    const proxy = http.request(options, proxy_res => {
      res.writeHead(proxy_res.statusCode, proxy_res.headers);
      proxy_res.pipe(res, { end: true });
    });

    proxy.on('error', (e) => {
      console.error(chalk`{inverse.red ERROR :: [${options.method.toUpperCase()}] ${options.path}}`);
      console.log(e);
      res.writeHead(400, options.headers);
      res.end(`problem with request: ${e.message}`)
    });

    proxy.on('socket', () => {
      req.pipe(proxy, { end: true });
    });

  }).listen(port);

  console.log(chalk`{inverse.bold.blue [${GAP('>> ESBUILD', 57)}]}`);
  const serve_infos = `serve at http://${host}:${port}`;
  console.log(chalk`{bold.blue [${GAP(serve_infos, 57)}]}`);

  return esbuild;
}

function PROXY_MAPPING(options, PROXY) {
  const { path: opath, method } = options;
  const proxy = PROXY.find(P => P.RULE.test(opath));

  // console.log(chalk`{inverse.gray [${method.toUpperCase()}] ${opath}}`);

  if(!proxy) { 
    return options;
  }

  const { RULE, UPSTREAM } = proxy;
  const { target, stream } = UPSTREAM;

  const { protocol, hostname, port } = target;
  const rpath = opath && stream ? opath.replace(stream[0], stream[1]) : opath;
  const upath = `${protocol}//${hostname}:${port}${rpath}`;

  options.hostname = hostname;
  options.path = rpath;
  options.port = port;

  console.log(chalk`{inverse.blue [>>ESBUILD]} {inverse.yellow [${GAP('DEV-SERVER', 45)}]}`);
  console.log(chalk`{yellow [${method.toUpperCase()}] ${opath}}`);
  console.log(chalk`{yellow [>>>] ${upath}}`);

  return options; 
}