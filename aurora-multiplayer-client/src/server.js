const fs = require("fs");
const pathPackage = require("path");
const isDev = require("electron-is-dev")

const gamePath = (isDev) ? pathPackage.resolve("../") :  process.env.PORTABLE_EXECUTABLE_DIR + "/";

let serverconfigData = null;
/* Config structure
serverconfigData = {
    type:"S3"|"ftp",
    address:"12.345.67.890"
}
*/

var serverType = null;
var username = null;
var password = null;
var Client = null;
var s3 = null;

// Read server config to see what server we are connecting to
fs.readFile(pathPackage.resolve(gamePath,"server.config"),(err,data)=>{
    if (err) {
        // No serverconfig found, assume S3
    } else {
        serverconfigData = JSON.parse(data.toString());
    }
    console.log(serverconfigData);
    serverType = serverconfigData != null ? serverconfigData.type : "S3"; 

    if (serverType === "S3") {
        const AWS = require('aws-sdk')
        AWS.config.region = 'us-east-1'; // Region
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'us-east-1:c4733679-8bcb-4b4e-931d-6794a9e28293',
        });
        const BUCKET_NAME = 'aurora-multiplayer-saves'
        s3 = new AWS.S3({
        apiVersion: "2006-03-01",
        params: {Bucket: BUCKET_NAME}
        });
    }
    if (serverType === "ftp") {
        Client = require("ftp-client");
        username = "anonymous";
        password = "anonymous@";
    }
});

// Changes the username and password for the ftp server connection
module.exports.configure = function(user, pass) {
    username = user;
    password = pass;
}

// Uploads data to server
// Takes the file located on path and uploads it to server

// example .upload("testgame", "multiplayer.config")
// will upload the file located at gameDir/multiplayer.config
// to gameName/multiplayer.config on the configured server 

module.exports.upload = async function(gameName, path) {
    if (serverType === "S3") {
        return _S3upload(gameName,path);
    }
    if (serverType === "ftp") {
        return _FTPupload(gameName,path);
    }
}

// Downloads data from server
// Takes the file located on path in the server and downloads it to path locally

// example .download("testgame", "AuroraDB.db")
// will download the file located at gameName/AuroraDB.db on the server
// and store it at gameDir/AuroraDB.db

module.exports.download = async function(gameName, path) {
    if (serverType === "S3") {
        return _S3download(gameName, path);
    }
    if (serverType === "ftp") {
        return _FTPdownload(gameName, path);
    }
}

// S3 upload and download functions
async function _S3upload(gameName, path, data) {
    throw "not implemented"
    const params = {
        Key: `${gameName}/${path}`,
        Body: data
    }
    return s3.upload(params, (err, data) => {
        if(err) {
            reject(err);
        }
    }).promise();
}

async function _S3download(gameName, path) {
    throw "not implemented";
    const params = {
        Key: `${gameName}/${path}`
    }
    const file = fs.createWriteStream(`${gamePath}/${path}`);
    s3.getObject(params).createReadStream().pipe(file);
    return new Promise((resolve, reject)=>{
        file.on("close",()=>{
            resolve();
        })
    });
}


// Ftp server upload and download functions
async function _FTPupload(gameName, path) {
    return new Promise((resolve,reject)=>{
        const ftpClient = new Client({
            host:serverconfigData.address,
            port:5505,
            user:username,
            password
        },{
            logging:"basic"
        });
        //ftpClient.ftp.verbose = true;
        ftpClient.connect(()=>{
            ftpClient.upload(
                pathPackage.resolve(gamePath,path),
                `/`,
                { overwrite:"all", baseDir:gamePath },
                (result)=>{
                    console.log(result);
                    resolve();
                }
            );
        });
    });
}

async function _FTPdownload(gameName,path) {
    return new Promise((resolve,reject)=>{
        const ftpClient = new Client();
        ftpClient.connect({
            host:serverconfigData.address,
            port:5505,
            username,
            password
        });
        ftpClient.on("ready",()=>{
            ftpClient.get(path,(err, stream)=>{
                if (err) {
                    reject();
                    throw err;
                }
                const file = fs.createWriteStream(`${gamePath}/${path}`);
                stream.once("close", () => {
                    ftpClient.end(); 
                    resolve();
                });
                stream.pipe(file);
            });
        });
    });
}
