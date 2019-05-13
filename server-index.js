// game server .js
var PORT = process.env.PORT || 8080;

var fs = require("fs");

var files = []; // game data array (used to be file name list, but who cares?)

var sessions = [];
var sessionsConnected = 0;

var serverTime = 0.0;
const tickDelta = 10;

/****************************************************************************
 * Removes unwanted characters and character sequences forom the words array
 ****************************************************************************/
function fixWords(wordsArray)
{
	var ret = [];
	for (var i = 0; i < wordsArray.length; i++)
		ret[i] = wordsArray[i].replace(/\./g, ' ').replace(/\,/g, ' ').replace(/\&/g, " and ").replace(/\-/g, ' ').replace(/\!/g, ' ').replace(/\?/g, ' ').replace(/\'/g, '').replace(/\s\s+/g, ' ').trim(); // should we replace ".", ",", "&" etc?

	return ret;
}

/*****************************************
 * Extracts gamedata from a gamedata file
 *****************************************/
function getGameData(filename)
{
	const fullPath = __dirname + "/gamedata/" + filename;

	try
	{	// attempt to read the .json file
		const strData = fs.readFileSync(fullPath).toString();

		var ret = JSON.parse(strData);
		ret.file = filename;
		ret.valid = true;
		ret.error = "No errors, you dum-dum";

		// fix the strings
		ret.words = fixWords(ret.words);

		// break strings with spaces into separate words
		var newWords = [];
		var indepIndex = 0;
		for (var i = 0; i < ret.words.length; i++)
		{
			var separateWords = ret.words[i].split(' ');

			for (var j = 0; j < separateWords.length; j++)
			{
				newWords[indepIndex] = separateWords[j];
				indepIndex++;
			}
		}
		ret.words = newWords;

		// set last update time
		ret.lvl_status = fs.statSync(fullPath).mtime.toISOString().replace("T", " ").split('.')[0];

		return ret;
	}
	catch (e)
	{ 	// error!
		console.log(e);

		// return the corrupt gamdata object with error
		return {
			title: "Corrupt (" + e.toString() + ")",
			file: filename,
			valid: false,
			error: e.toString(),
			words: []
		};
	}
}

/*******************************
 * Return the scoreboard object
 *******************************/
function getScoreboard(filename)
{
	const fullPath = __dirname + "/gamedata/" + filename + ".scoreboard.json"; // scoreboard file name

	try
	{	// try to read the scoreboard
		var ret = JSON.parse(fs.readFileSync(fullPath).toString());

		if (!ret.symPerSec) ret.symPerSec = 0;
		if (!ret.symPerSecHolder) ret.symPerSecHolder = "no one";
		if (!ret.words) ret.symPerSec = 0;
		if (!ret.wordsHolder) ret.wordsHolder = "no one";

		return ret;
	}
	catch (e) 
	{	// return a default scoreboard
		console.log(e);

		return {
			symPerSec: 0,
			symPerSecHolder: "no one",
			words: 0,
			wordsHolder: "no one"
		};
	}
}

/************************************
 * gets a list of all gamedata files
 ************************************/
function getFileList()
{
	const gameDataFileExt = ".json"; // gamedata file extension

	console.log("Updating game data files list...");

	files = []; // clear array

	const onlyFiles = fs.readdirSync(__dirname + "/gamedata/"); // an unfiltered list
	var j = 0;
	onlyFiles.forEach(function(entry)
	{
		if (entry.lastIndexOf(gameDataFileExt) + gameDataFileExt.length == entry.length) // only .json
		if (entry.lastIndexOf(".scoreboard.json") == -1) // ignore scoreboards
		{ 	// does it match the extension?
			console.log(entry);
			files[j] = getGameData(entry);
			j++;
		}
	});
}

/******************************************
 * updates gamedata and sends it to client
 ******************************************/
function updateAndSendGameData(socket)
{
	getFileList(); // update game data
	socket.emit("recieveGameDataFiles", files); // send game data to a client
	console.log("Sent gamedata to client");
}

/*************************************************
 * Registers a session on index i for socket sock
 *************************************************/
function registerSession(i, sock, data)
{
	const sessionPingTime = serverTime;
	var sessionData =
	{
		socket: sock,
		time: serverTime + parseFloat(data.initialDelta),
		pingTime: serverTime,
		tolerateDelta: config.tick_tolerance * tickDelta,
		ping: 0,
		sessionDelta: 0, // difference from a client
		accusations: 0,
		gameData: getGameData(data.gameDataFile),
		username: data.nick,
		// scores
		wordIndex: 0,
		wordScore: 0,
		charIndex: 0,
		symbolScore: 0
	};

	sessions[i] = sessionData;
	sessionsConnected++;

	sessions[i].socket.emit("sessionAddSuccess", null);
	
	console.log("Added a session (" + sessionData + ") for client " + sock.id);
}

/*****************************************************
 * Tries to find and remove the session from the list
 * for given socket.id
 *****************************************************/
function destroySession(socketId, dropReason, closeTime)
{
	for (var i = 0; i < sessions.length; i++)
		if (sessions[i] != null) if (sessions[i].socket.id == socketId) // there is a session opened for this client
		{	// remove session
			console.log("Removed session for client " + socketId + ". Reason: " + dropReason + " [" + (sessionsConnected - 1) + " left]");
			sessions[i].socket.emit("sessionRemoved", 
			{ 
				reason: dropReason, 
				time: closeTime - sessions[i].time,
				score: 
				{ 
					words: sessions[i].wordScore,
					symbols: sessions[i].symbolScore
				}
			});
			sessions[i] = null;
			sessionsConnected--;
		}
}

/**************************************
 * Called every tickDelta milliseconds
 **************************************/
function serverTick()
{
	if (sessionsConnected > 0) 
	{
		serverTime = parseInt(serverTime) + tickDelta; // tick if there are active sessions
		for (var i = 0; i < sessions.length; i++)
		{
			if (sessions[i] != null) 
			{
				sessions[i].sessionDelta = 0;
				sessions[i].socket.emit("adjustTime", { deltaTime: -sessions[i].sessionDelta });
			}
		}
	}
	else serverTime = 0; // else clear the timer
}

/*******************
 * main server code
 ******************/
// load game config
const config = (function ()
{
	const configStr = fs.readFileSync(__dirname + "/server-config.json").toString();
	return JSON.parse(configStr);
})();

// run a server
var express = require("express");
var app = express();

var server = require("http").createServer(app);

console.log("Starting server...");

app.get("/", function(req, res) {
	res.sendFile(__dirname + "/index.html");

	/*
	 * The following piece of code
	 * used to generate the webpage from index.html
	 * without a link to client-index.js (replacing
	 * it with actual script contents) to prevent
	 * hacking. Well, it didn't help to completely
	 * hide the source code, so it's just irrelevent
	 * now.
	 */
	/*res.setHeader("Content-Type", "text/html");

	var htmlLines = fs.readFileSync(__dirname + "/index.html");

	var jsClientLines = fs.readFileSync(__dirname + "/client-index.js");

	var lines = htmlLines.toString().replace("<script src=\"client-index.js\"></script>", "<script>" + jsClientLines.toString() + "</script>");

	res.write(lines);
		
	res.end();*/
});

// creator could be disabled, handle it separately
app.get("/creator.html", function(req, res) {
	if (config.enable_editor) res.sendFile(__dirname + "/creator.html");
	else 
	{	// creator feature could be disabled!
		res.write("<div align=\"center\"><h1>Feature is disabled in the server config! Press any key to return to main menu.</h1></div>");
		res.write("<script>document.addEventListener(\"keydown\", function() { window.location.href = \"/\"; }, false);</script>");
		res.end();
	}
});

app.use("/", express.static(__dirname));

console.log("Server started!");

var io = require("socket.io")(server);

io.sockets.on("connection", function(socket)
{
	console.log("Connection!");

	// Game data request from a client
	socket.on("requestGameDataFiles", function(data)
	{
		updateAndSendGameData(socket);
	});

	// Scoreboard request from a client
	socket.on("requestScoreboard", function(data)
	{
		console.log("Scoreboard requested by " + socket.id);
		socket.emit("recieveScoreboard", getScoreboard(data.filename));
	});

	// Game session request
	socket.on("gameStart", function(data)
	{
		console.log(data);
		for (var i = 0; i <= sessions.length; i++) // find the first empty session
			if (!sessions[i])
			{
				registerSession(i, socket, data);
				break;
			}
			else if (!sessions[i].socket.id)
			{
				registerSession(i, socket, data);
				break;
			}
	});

	// When an action happens in the game!
	socket.on("gameAction", function(data)
	{
		// find a matching session. If can't, ignore
		var found = false;
		for (var i = 0; i < sessions.length; i++)
			if (sessions[i]) if (sessions[i].socket.id == socket.id)
			{
				found = true;
				break;
			}
		if (!found) return;

		sessions[i].sessionDelta = data.delta - serverTime + sessions[i].time;
		const diff = sessions[i].sessionDelta; // delet this

		// process the event
		if (data.type = "key")
		{
			console.log("Client " + socket.id + " pressed " + data.value + ". DeltaS: " + data.delta + "; Server delta: " + (serverTime - sessions[i].time) + "; Diff: " + diff + "; Tolerance: " + sessions[i].tolerateDelta);

			const key = data.value.toUpperCase();
			const words = sessions[i].gameData.words;

			if (words[sessions[i].wordIndex].toUpperCase().charAt(sessions[i].charIndex) == key)
			{
				sessions[i].charIndex++;

				if (sessions[i].charIndex == words[sessions[i].wordIndex].length)
				{
					sessions[i].wordScore++;
					sessions[i].symbolScore += words[sessions[i].wordIndex].length;

					sessions[i].wordIndex++;
					if (sessions[i].wordIndex == words.length) sessions[i].wordIndex = 0;
					sessions[i].charIndex = 0;
				}
			}
			else
			{
				sessions[i].charIndex = 0;
			}

			console.log("CI: " + sessions[i].charIndex + "; WI: " + sessions[i].wordIndex + "; CS: " + sessions[i].symbolScore + "; WS: " + sessions[i].wordScore);
		}

		if (Math.abs(diff) <= sessions[i].tolerateDelta + config.ping_tolerance * sessions[i].ping) 
		{
			sessions[i].accusations = 0;
		}
		else sessions[i].accusations++;

		if (sessions[i].accusations > config.max_accusations) destroySession(sessions[i].socket.id, "Async (Hacking?)", serverTime);
	});

	// Request to close a game session
	socket.on("gameEnd", function(data)
	{
		console.log("Game end requested for " + socket.id);

		const closeTime = serverTime;
		if (config.scoreboards)
		{	// check for the highscore
			var symps = 0;
			var words = 0;
			var holderUName = "Unknown Hero";
			var finished = false;
			for (var i = 0; i < sessions.length; i++)
				if (sessions[i]) if (sessions[i].socket.id == socket.id)
				{
					symps = 1000 * sessions[i].symbolScore / (closeTime - sessions[i].time);
					holderUName = sessions[i].username;
					finished = (sessions[i].wordScore >= sessions[i].gameData.words.length);

					console.log(socket.id + "\'s SymPS is " + symps);

					break;
				}

			if (!sessions[i]) { console.log("Session not found :("); return; }

			const scoreboardFile = __dirname + "/gamedata/" + sessions[i].gameData.file + ".scoreboard.json";
			var writeObj = null;
			if (fs.existsSync(scoreboardFile))
			{
				writeObj =  JSON.parse(fs.readFileSync(scoreboardFile).toString()); 

				if (writeObj.symPerSec) 
				{ 
					if (writeObj.symPerSec < symps) if (finished)
					{
						writeObj.symPerSec = parseFloat(symps).toFixed(2);
						writeObj.symPerSecHolder = holderUName;
					}

				}
				else
				{
					writeObj.symPerSec = finished?parseFloat(symps).toFixed(2):0;
					writeObj.symPerSecHolder = finished?holderUName:"no one";
				}

				if (writeObj.words) 
				{
					if (writeObj.words < sessions[i].wordScore)
					{
						writeObj.words = sessions[i].wordScore;
						writeObj.wordsHolder = holderUName;
					}
				}
				else
				{
					writeObj.words = sessions[i].wordScore;
					writeObj.wordsHolder = holderUName;
				}
			}
			else
			{
				writeObj =
				{
					symPerSec: finished?parseFloat(symps).toFixed(2):0,
					symPerSecHolder: finished?holderUName:"no one",
					words: sessions[i].wordScore,
					wordsHolder: holderUName
				};
			}

			// write scoreboad
			fs.writeFileSync(scoreboardFile, JSON.stringify(writeObj));
		}
		
		destroySession(socket.id, "Game Ended", closeTime);
	});

	socket.on("clientPong", function(data)
	{
		const pongTime = serverTime;

		for (var i = 0; i < sessions.length; i++)
			if (sessions[i]) if (sessions[i].socket.id == socket.id)
			{
				const ping = pongTime - sessions[i].pingTime;
				sessions[i].ping = (ping < 10)?10:ping;
				console.log("Ping for " + socket.id + " is " + sessions[i].ping);
			}
	});

	// On game session exit
	socket.on("disconnect", function(data)
	{
		console.log("Client disconnected");
		destroySession(socket.id, "Client Disconnected", serverTime);
	});

	// Level submission from a creator
	socket.on("submitLevel", function(data)
	{
		console.log("Recieved a level submission!");

		var jsonString;

		if (data.title && Array.isArray(data.words))
		{	// seem legit

			data.words = fixWords(data.words);

			jsonString = JSON.stringify(data);

			console.log(jsonString);
		}
		else
		{	// invalid object format
			console.log("Invalid object!");

			socket.emit("submissionResult", { result: false, desc: "Invalid object!" });

			return;
		}

		if (!config.enable_editor)
		{	// if editor is disabled, submittting levels is also disabled!
			console.log("Level submission is disabled in server config!");
			
			socket.emit("submissionResult", { result: false, desc: "Level submission is disabled in server config!" });

			return;
		}

		fs.writeFile(__dirname + "/gamedata/" + data.title.split(" ").join("") + Date.now() + ".json", jsonString, function(err)
		{
			if (err)
			{
				console.log(err);
				socket.emit("submisionResult", { result: false, desc: err.toString() });
			}
		});
		
		socket.emit("submissionResult", { result: true, desc: "Success!" });
	});
});

setInterval(serverTick, tickDelta);

server.listen(PORT);
console.log("Server is listening on port: " + PORT);
