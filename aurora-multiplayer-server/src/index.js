const path = require("path");
const FtpSrv = require("ftp-srv");
const fs = require("fs");
const isDev = process.env.NODE_ENV === "dev";
const server = new FtpSrv({ 
    url:"ftp://127.0.0.1:5505",
    pasv_url:"ftp://127.0.0.1"
});
const directory = isDev ? path.resolve(process.cwd()) : path.dirname(process.execPath);

// Confirm that data directory exists
fs.access(path.resolve(directory,"data"),fs.constants.F_OK,(err)=>{
    if (err) {
        // If data directory does not exist, create a new one
        fs.mkdir(path.resolve(directory,"data"),(err)=>{
            if (err) {
                throw err;
            }
        });
    }
});

let games = {};

// Parse the server.config
fs.readFile(path.resolve(directory,"server.config"),(err,data)=>{
    if (err) {
        console.log(err.message);
        fs.writeFile(path.resolve(directory,"server.config"),JSON.stringify({}),(err)=>{
            if (err) {
                throw err;
            } else {
                console.log("Created empty config file");
            }
        });
        
    } else {
        games = JSON.parse(data);
    }
});

// Save the games on exit
function exitHandler() {
    console.log("saving");
    fs.writeFileSync(path.resolve(directory,"server.config"),JSON.stringify(games));
    process.exit();
}
process.on("exit", exitHandler.bind());
process.on("SIGINT", exitHandler.bind());

// Handle logins
server.on('login', ({connection, username, password}, resolve, reject)=> {
    
    // Check credentials
    if (games[username] !== undefined && games[username] !== password) {
        // Failed to auth
        reject();
        return;
    }

    if (games[username] === undefined) {
        games[username] = password;
    }

    // Confirm that username directory exists
    fs.access(path.resolve(directory,"data",username),fs.constants.F_OK,(err)=>{
        if (err) {
            // If username directory does not exist create one
            fs.mkdir(path.resolve(directory,"data",username),(err)=>{
                if (err) {
                    reject();
                    throw err;
                } else {
                    resolve({
                        root:path.resolve(directory,"data",username)
                    });
                }
            });
        } else {
            resolve({
                root:path.resolve(directory,"data",username)
            });
        }
    })
});

// Start the server
console.log("Starting server at " + directory);
server.listen().then(()=>{ });