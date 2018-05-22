Simple HTTP file server (Node.JS)
=================================

[![NPM](https://nodei.co/npm/http-file-server.png)](https://nodei.co/npm/http-file-server/)

**WARNING!** This is a dead project.
Any updates usually is just for supressing vulnerability alerts.

Usage
-----

To start file server in current working directory on 8080 port:

```bash
./http-file-server.js
```

For details run `./http-file-server.js --help`:

```text
USAGE
=====

--help      View this information
--path=abc  Set path of file server root directory (default is current dir)
--host=abc  Hostname of http-server (default is "localhost"),
            use "*" for any host
--port=abc  Port of http-server (default is "8080")
--browse    Open hostname in browser (via "xdg-open")
--debug     Logging every request
--no-cache  Disable caching in headers
```

Author
------

Viacheslav Lotsmanov

License
-------

[GPLv3](LICENSE)
