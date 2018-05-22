#!/usr/bin/env node
/*!
 * Node.JS HTTP file server
 *
 * Author: Viacheslav Lotsmanov <lotsmanov89@gmail.com>
 * License: GPLv3
 */

// default configs
var host         = 'localhost';
var port         = 8080;
var filesPath    = null;
var browse       = false;
var debug        = false;
var noCache      = false;

var defEnc       = 'utf-8';
var contentTypes = {
    // case insensitive

    /** pages/styles/plain-text */
    '.html' : 'text/html; charset='+defEnc,
    '.css'  : 'text/css; charset='+defEnc,
    '.less' : 'text/css; charset='+defEnc, // see ‘less’ css framework
    '.js'   : 'text/javascript; charset='+defEnc,
    '.txt'  : 'text/plain; charset='+defEnc,

    /** images */
    '.png'  : 'image/png',
    '.jpeg' : 'image/jpeg',
    '.jpg'  : 'image/jpeg',
    '.jpe'  : 'image/jpeg',
    '.gif'  : 'image/gif',
    '.svg'  : 'image/svg+xml; charset='+defEnc,
    '.svgz' : 'image/svg+xml; charset='+defEnc,
    '.ico'  : 'image/x-icon',

    /** fonts */
    '.eot'  : 'application/vnd.ms-fontobject',
    '.woff' : 'application/font-woff',
    '.ttf'  : 'font/ttf',

    /** downloading other files */
    '*'     : 'application/octet-stream'
};

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var spawn = require('child_process').spawn;

for (var i=2, arg=process.argv[i]; i<process.argv.length; i++, arg=process.argv[i]) {
    if (/^--help$/.test(arg)) {
        console.log(
            '\nUSAGE\n=====\n\n'
            +'--help      View this information\n'
            +'--path=abc  Set path of file server root directory (default is current dir)\n'
            +'--host=abc  Hostname of http-server (default is "'+host+'"), use "*" for any host\n'
            +'--port=abc  Port of http-server (default is "'+port+'")\n'
            +'--browse    Open hostname in browser (via "xdg-open")\n'
            +'--debug     Logging every request\n'
            +'--no-cache  Disable caching in headers\n'
        );
        process.exit(0);
    } else if (/^--path=.+$/.test(arg)) {
        if (filesPath === null) filesPath = arg.replace(/^--path=/, '');
    } else if (/^--host=.+$/.test(arg)) {
        host = arg.replace(/^--host=/, '');
        if (host == '*') host = null;
    } else if (/^--port=.+$/.test(arg)) {
        port = arg.replace(/^--port=/, '');
    } else if (/^--browse$/.test(arg)) {
        browse = true;
    } else if (/^--debug$/.test(arg)) {
        debug = true;
    } else if (/^--no-cache$/.test(arg)) {
        noCache = true;
    } else {
        console.error('Unknown argument "'+arg+'"');
        console.log('Run with --help argument for view usage information');
        process.exit(1);
    }
}

if (filesPath === null) {
    filesPath = process.cwd();
    console.warn('Path is empty! Will be used current work dir: "'+filesPath+'"');
    console.warn('For specific path, start this app with: --path=/specific/path');
}

filesPath = filesPath
    .replace('~', process.env['HOME'])
    .replace(/^\.\//, process.cwd()+'/');

http.createServer(function (req, res) {
    var msgHTTP200 = ' (HTTP status: 200)';
    var msgHTTP404 = ' (HTTP status: 404)';
    var msgHTTP500 = ' (HTTP status: 500)';

    var pathname = url.parse(req.url).pathname;
    pathname = decodeURIComponent(pathname.split('+').join(' '));
    while (pathname.substr(0, 1) == '/') {
        pathname = pathname.substr(1);
    }
    debug && console.log('HTTP-request for pathname: "/'+pathname+'"');

    var fullPath = path.join(filesPath, pathname);
    var fileDescriptor = null;
    var fileStat = null;

    function tellAboutError(errNum, errMsg) {
        res.writeHead(errNum, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Error '+errNum+'. '+errMsg);
    }

    function listDir() {
        var template = '<!doctype html>'
            +'<html>'
            +'<head>'
                +'<meta charset="utf-8">'
                +'<title>Directory "#PATHNAME#"</title>'
            +'</head>'
            +'<body>'
                +'<h1>Directory "#PATHNAME#"</h1>'
                +'<ul>'
                    +'#LIST_ELEMENTS#'
                +'</ul>'
            +'</body>'
            +'</html>';
        var listElementTemplate = '<li>#TYPE# <a href="#LINK#">#TITLE#</a></li>';

        debug && console.log('Listing directory "'+fullPath+'" ...');
        fs.readdir(fullPath, function (err, files) {
            if (err) {
                debug && console.error('Read dir error "'+fullPath+'"'+msgHTTP500);
                tellAboutError(500, 'Cannot read directory.');
                return;
            }

            var dirsList = [];
            var filesList = [];
            var listElements = '';

            if (pathname !== '' && pathname !== '/') {
                listElements += listElementTemplate
                    .replace(/#TYPE#/g, '[D]')
                    .replace(/#LINK#/g, './..')
                    .replace(/#TITLE#/g, '..');
            }

            files.forEach(function (file) {
                var filePath = path.join(fullPath, file);
                var stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    dirsList.push(file);
                } else if (stat.isFile()) {
                    filesList.push(file);
                }
            });

            dirsList = dirsList.sort();
            filesList = filesList.sort();

            dirsList.forEach(function (name) {
                listElements += listElementTemplate
                    .replace(/#TYPE#/g, '[D]')
                    .replace(/#LINK#/g, './'+name+'/')
                    .replace(/#TITLE#/g, name);
            });

            filesList.forEach(function (name) {
                listElements += listElementTemplate
                    .replace(/#TYPE#/g, '[F]')
                    .replace(/#LINK#/g, './'+name)
                    .replace(/#TITLE#/g, name);
            });

            var html = template
                .replace(/#PATHNAME#/g, '/' + pathname)
                .replace(/#LIST_ELEMENTS#/g, listElements);

            var head = {};
            head['Content-Type'] = 'text/html; charset=utf-8';
            head['Content-Length'] = Buffer.byteLength(html, defEnc);
            if (noCache) {
                head['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                head['Pragma'] = 'no-cache';
                head['Expires'] = '0';
            }

            debug && console.log('Directory "'+fullPath+'" is opened'+msgHTTP200);
            res.writeHead(200, head);
            res.end(html);
        });
    }

    function openFile() {
        debug && console.log('Opening file "'+fullPath+'" ...');
        var stream = fs.createReadStream(fullPath, 'binary', {
            flags: 'r',
            encoding: defEnc,
            autoClose: true
        });

        var head = {};
        head['Content-Length'] = fileStat.size;

        if (noCache) {
            head['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            head['Pragma'] = 'no-cache';
            head['Expires'] = '0';
        }

        for (var ext in contentTypes) {
            if (ext == '*') continue;
            if (ext == path.extname(fullPath)) {
                debug && console.log('File "'+fullPath+'" mime-type is "'
                    +contentTypes[ext]+'"'+msgHTTP200);
                head['Content-Type'] = contentTypes[ext];
            }
        }

        if ( ! ('Content-Type' in head)) {
            if (typeof contentTypes['*'] === 'string') {
                debug && console.log('File "'+fullPath+'" mime-type is "'
                    +contentTypes['*']+'"'+msgHTTP200);
                head['Content-Type'] = contentTypes['*'];
            } else {
                debug && console.log('Cannot detect file mime-type "'
                    +fullPath+'"'+msgHTTP200);
            }
        }

        res.writeHead(200, head);

        debug && console.log('Reading file "'+fullPath+'" ...');
        stream.on('data', function (chunk) {
            res.write(chunk, 'binary');
        });

        stream.on('error', function (err) {
            debug && console.error('Read file error "'+fullPath+'"'+msgHTTP500);
            tellAboutError(500, 'Cannot read file.');
        });

        stream.on('end', function () {
            debug && console.log('Reading file "'+fullPath+'" is finished');
            res.end();
        });
    }

    function getStatCallback(err, stat) {
        if (err) {
            debug && console.error('Cannot get file stat "'+fullPath+'"'+msgHTTP500);
            tellAboutError(500, 'Cannot open this path.');
            return;
        }

        fileStat = stat;

        if (fileStat.isFile()) {
            process.nextTick(openFile);
        } else if (fileStat.isDirectory()) {
            process.nextTick(listDir);
        } else {
            debug && console.error('Unknown type of inode "'+fullPath+'"'+msgHTTP500);
            tellAboutError(500, 'Cannot open this path.');
            return;
        }
    }

    fs.exists(fullPath, function (exists) {
        if ( ! exists) {
            debug && console.error('Path "'+fullPath+'" is not found'+msgHTTP404);
            tellAboutError(404, 'Page not found.');
            return;
        }

        /** opening file descriptor */
        fs.open(fullPath, 'r', function (err, fd) {
            if (err) {
                debug && console.error('Cannot open file descriptor "'+fullPath+'"'+msgHTTP500);
                tellAboutError(500, 'Cannot open this path.');
                return;
            }

            fileDescriptor = fd;
            fs.fstat(fileDescriptor, getStatCallback);
        });
    });
}).listen(port, host, function () {
    var httpAddr = 'http://'+((host) ? host : 'localhost')+':'+port;
    var host = (host) ? host : '*';
    console.log('HTTP-server started at '+host+':'+port+', files path is: "'+filesPath+'"');
    if (browse) {
        console.log('Start xdg-open to open page "'+httpAddr+'" in browser');
        spawn('xdg-open', [httpAddr], { stdio: 'inherit' });
    }
});

// vim: set fenc=utf-8 ts=4 sw=4 expandtab :
