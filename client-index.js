// client-side game .js
(function(){ // just to make all variables invisible from global workspace
var socket = io();

var gamedatafiles = []; // gamedata files list

// menu helper vars
var menuEntry = 0;
var menuEntryMax = 0;

const mainMenuEntries =
[
	"PLAY",
	"CREATE A LEVEL"
];

// canvas
var canvas = document.getElementById("game_canvas");
var context = canvas.getContext("2d");

// game life functions
var renderIntervalId = -1;
var tickIntervalId = -1;
var renderFunction = function() {};
var inputFunction = function(e) {};
var prevListener = null;

// user defined data
var username = "Unknown Hero";

// game data
var gameData = 	// current game data object
{
	title: "Null",
	valid: false,
	words: [ ]
};
var wordIndex = 0;	// current word index
var letterIndex = 0;	// current letter index
var millisecondsLeft = 0;	// seconds left till lose
var wordScore = 0;	// number of successfully typed words
var symbolScore = 0;	// number of symbols in successfully typed words
var timeTotal = 0;	// total time passed since game start
var connectionStatus = 
{
	connected: false,
	message: "OK"
};

// scoreboard
var scoreboardReady = false;
var scoreboard = null;

// render helpers
var frame = 0;
var wordScale = 1.5;	// used for the appearance effect

/*********************
 * Initializes canvas with proper dimensions
 *********************/
function init_canvas()
{
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}

/****************************************
 * Defines the behaviour on a timer tick
 ****************************************/
function timeTickFunction()
{ 
	timeTotal = parseInt(timeTotal) + 10; 	// add tick duration
	millisecondsLeft -= 10; 				// subtract --//--
	if ((gameData.use_timelimit) && (millisecondsLeft <= 0))
	{	// player has no time left
		loadScoreScreen();
	}
}

/********************************************************
 * Fires when a timer adjustment is called from a server
 ********************************************************/
function adjustTime(timeDelta)
{
	timeTotal += timeDelta;
	millisecondsLeft -= timeDelta;
}

/***************************************
 * Updates renderer and input functions
 ***************************************/
function runRendererAndInput()
{
	if (renderIntervalId != -1) clearInterval(renderIntervalId); // stop previous renderer if exists
	renderIntervalId = setInterval(function()
	{
		renderFunction();
		frame++;
	}, 15); // run a new renderer
	if (prevListener != null) document.removeEventListener("keydown", prevListener, false); // remove previous input listener if exists
	document.addEventListener("keydown", inputFunction, false); // apply new input listener
	prevListener = inputFunction;
}

/*********************
 * Load the main menu
 *********************/
function loadMainMenu()
{
	// prepare helper vars
	menuEntry = 0;
	menuEntryMax = mainMenuEntries.length - 1;

	// roll the main menu
	renderFunction = mainMenuRenderer;
	inputFunction = mainMenuInput;

	wordScale = 1.5;

	runRendererAndInput();
}

/***********************
 * Load the file picker
 ***********************/
function loadFilePicker()
{
	socket.emit("requestGameDataFiles", null); // request an update of game data
	manuEntry = 0;
	menuEntryMax = gamedatafiles.length - 1;
	document.title = "Word-type-inator"; // reset the title back to normal
	if (tickIntervalId != -1) clearInterval(tickIntervalId); // stop tick if not already

	// run the file picker
	renderFunction = filePickRenderer;
	inputFunction = filePickInput;

	runRendererAndInput();
}

/*****************************
 * Load the scoreboard screen
 *****************************/
function loadScoreboard()
{
	scoreboardReady = false;
	socket.emit("requestScoreboard", { filename: gamedatafiles[menuEntry].file });

	renderFunction = scoreboardRenderer;
	inputFunction = scoreboardInput;

	runRendererAndInput();
}

/*************************
 * Shows the score screen
 *************************/
function loadScoreScreen()
{
	if (tickIntervalId != -1)
	{	// stop timer if not already
		clearInterval(tickIntervalId);
		tickIntervalId = -1;
	}
	wordScale = 1.5;

	// roll "Game Over" screen
	socket.emit("gameEnd", null);

	scoreboardReady = false;
	socket.emit("requestScoreboard", { filename: gamedatafiles[menuEntry].file });

	renderFunction = scoreRenderer;
	inputFunction = scoreInput;

	wordScore = 1.5;
	
	runRendererAndInput();
}

/*****************************************************
 * Main menu rednerer function: Redners the main menu
 *****************************************************/
function mainMenuRenderer()
{
	context.clearRect(0, 0, canvas.width, canvas.height);

	const menuEntryHeight = canvas.height / 5 * wordScale;

	context.font = menuEntryHeight + "px Arial";
	
	for (var i = 0; i < mainMenuEntries.length; i++)
	{
		if (i == menuEntry) context.fillStyle = "#FF0000";
		else context.fillStyle = "#000000";
		context.fillText(mainMenuEntries[i], (canvas.width - context.measureText(mainMenuEntries[i]).width) / 2, (i + 2) * menuEntryHeight);
	}

	wordScale = (wordScale + 1.0) / 2;
}

/***************************
 * Main menu input function
 ***************************/
function mainMenuInput(e)
{
	switch (e.key)
	{
		case "ArrowUp":
			if (menuEntry > 0) menuEntry--;
			else menuEntry = menuEntryMax;
			break;
		case "ArrowDown":
			if (menuEntry < menuEntryMax) menuEntry++;
			else menuEntry = 0;
			break;
		case "Enter":
			switch (menuEntry)
			{
				case 0:	// "Play"
					loadFilePicker();
					break;
				case 1:
					window.location.href = "creator.html";
					break;
			}
			break;
	}
}

/*********************************************************
 * File picker renderer function: Renders the file picker
 *********************************************************/
function filePickRenderer()
{
	context.clearRect(0, 0, canvas.width, canvas.height);
	const header = "SELECT A LEVEL";
	const headerSize = canvas.height / 20;
	const helperSize = canvas.height / 40; // header font size

	// draw the header
	context.fillStyle = "#000000"; // i doubt it really needs a header
	context.font = headerSize + "px Arial";
	var stringWidth = context.measureText(header).width;
	context.fillText(header, (canvas.width - stringWidth) / 2, headerSize);

	const selectedTitle = gamedatafiles[menuEntry].title.toUpperCase();
	const selectedHeight = canvas.height / 13;	
	const neighbourHeight = canvas.height / 17;

	// draw list progress bar
	const progress = (menuEntry + 1) / gamedatafiles.length;
	context.fillStyle = "#999999";
	context.fillRect(canvas.width / 4, (canvas.height + selectedHeight) / 2 + neighbourHeight + 15,
			canvas.width / 2, canvas.height / 100);
	context.fillStyle = "#FF0000";
	context.fillRect(canvas.width / 4, (canvas.height + selectedHeight) / 2 + neighbourHeight + 15,
			canvas.width / 2 * progress, canvas.height / 100);

	// draw neighbour entries
	context.fillStyle = "#AAAAAA";

	context.font = (neighbourHeight * (wordScale + 1.0)) + "px Arial";
	const prevTitle = gamedatafiles[(menuEntry > 0)?(menuEntry - 1):(gamedatafiles.length - 1)].title.toUpperCase();
	context.fillText(prevTitle, (canvas.width - context.measureText(prevTitle).width) / 2, (canvas.height - selectedHeight) / 2 - 15);
	context.font = (neighbourHeight * (-wordScale + 1.0)) + "px Arial";
	const nextTitle = gamedatafiles[(menuEntry < gamedatafiles.length - 1)?(menuEntry + 1):0].title.toUpperCase();
	context.fillText(nextTitle, (canvas.width - context.measureText(nextTitle).width) / 2, (canvas.height + selectedHeight + neighbourHeight) / 2 + 15);

	// draw the selected entry
	context.fillStyle = "#FF0000";
	context.font = selectedHeight + "px Arial";
	context.fillText(selectedTitle, (canvas.width - context.measureText(selectedTitle).width) / 2, (canvas.height + selectedHeight / 2) / 2);
	
	// draw helper text
	context.fillStyle = "#777777";
	context.font = helperSize + "px Arial";
	const helper = "<ENTER> = SELECT, <ESC> = BACK TO MAIN MENU, <V> = VIEW HIGHSCORES FOR A LEVEL";
	context.fillText(helper, (canvas.width - context.measureText(helper).width) / 2, canvas.height - 10);

	wordScale = wordScale / 2;
}

/****************************************************************
 * File picker input function: Handles input for the file picker
 ****************************************************************/
function filePickInput(e)
{
	switch(e.key)
	{
		case "ArrowUp":
			if (menuEntry > 0) menuEntry--;
			else menuEntry = menuEntryMax;
			wordScale = -0.5;
			break;
		case "ArrowDown":
			if (menuEntry < menuEntryMax) menuEntry++;
			else menuEntry = 0;
			wordScale = 0.5;
			break;
		case "Enter":
			// reset scores & counters
			wordIndex = 0;
			letterIndex = 0;
			wordScore = 0;
			symbolScore = 0;
			timeTotal = 0;

			gameData = gamedatafiles[menuEntry]; // update the game data object from the list
			if (gameData.valid)
			{
				// valid game object
				document.title = gameData.title; // load title
				millisecondsLeft = parseInt(gameData.initial_time * 1000); // load timeout

				// run the game
				renderFunction = prepareRenderer;
				inputFunction = prepareInput;

				wordScale = 1.5;

				runRendererAndInput();
			}
			else alert("Ivalid game data file!\n" + gameData.error);
			
			break;
		case "V":case "v":
			// view scoreboards
			gameData = gamedatafiles[menuEntry];
			loadScoreboard();
			break;
		case "Escape":
			loadMainMenu();
			break;
	}
}

/*************************
 * Renders the scoreboard
 *************************/
function scoreboardRenderer()
{
	var header;
	const headerSize = 50; // header font size
	const entrySize = 30; // list font size

	if (scoreboardReady) header = gameData.title + " Scoreboard";
	else header = "Loading...";

	// draw the header
	context.fillStyle = "#000000";
	context.font = headerSize + "px Arial";
	var stringWidth = context.measureText(header).width;
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillText(header, (canvas.width - stringWidth) / 2, headerSize);

	context.font = entrySize + "px Arial";
	if (scoreboardReady)
	{	// draw symbols per second highscore
		var y = headerSize + 20 + entrySize;
		context.fillText("Most symbols per second: ", 10, y);
		const symPerSecText = scoreboard.symPerSec + " by " + scoreboard.symPerSecHolder;
		context.fillText(symPerSecText, canvas.width - 10 - context.measureText(symPerSecText).width, y);

		// draw words highscore
		y += entrySize;
		context.fillText("Most words typed: ", 10, y);
		const wordsText = scoreboard.words + " by " + scoreboard.wordsHolder;
		context.fillText(wordsText, canvas.width - 10 - context.measureText(wordsText).width, y);
	}

	// draw helper message
	context.fillStyle = "#777777";
	const helper = "<ESC> = BACK";
	context.fillText(helper, (canvas.width - context.measureText(helper).width) / 2, canvas.height - 10);
}

/***************************
 * Handles scoreboard input
 ***************************/
function scoreboardInput(e)
{
	switch (e.key)
	{
		case "Escape":
			loadFilePicker();
			break;
	}
}

/************************************************************************************
 * Preparation screen render function: The one that says "Press <ENTER> to continue"
 ************************************************************************************/
function prepareRenderer()
{
	const prepareTextSize = canvas.height / 10 * wordScale;
	const prepareText = "PRESS <ENTER> TO CONTINUE";
	context.fillStyle = "#000000";
	context.font = prepareTextSize + "px Arial";

	const txtWidth = context.measureText(prepareText).width;

	context.clearRect(0, 0, canvas.width, canvas.height);

	context.fillText(prepareText, (canvas.width - txtWidth) / 2, (canvas.height + prepareTextSize / 2) / 2);

	wordScale = (wordScale + 1.0) / 2;
}

/*********************************************************************************
 * Preparation screen input function: Just send player to the game on Enter press
 *********************************************************************************/
function prepareInput(e)
{
	if (e.key == "Enter")
	{
		renderFunction = mainGameRenderer;
		inputFunction = mainGameInput;

		tickIntervalId = setInterval(timeTickFunction, 10); // run timer
		socket.emit("gameStart", { initialDelta: timeTotal, gameDataFile: gameData.file, nick:  username });

		runRendererAndInput();
	}
}

/**************************************************************
 * Main game render function: Diplays the word, top(time left) 
 * and bottom(list progress) bars
 **************************************************************/
function mainGameRenderer()
{
	context.clearRect(0, 0, canvas.width, canvas.height);

	const textSize = canvas.height / 5 * wordScale;
	const upcomingSize = canvas.height / 15;
	context.font = textSize + "px Arial";

	const word = gameData.words[wordIndex].toUpperCase();

	const preWord = word.substring(0, letterIndex);
	const postWord = word.substring(letterIndex);
	const stringWidth = context.measureText(word).width;
	const preWidth = context.measureText(preWord).width;

	// draw the current word
	context.fillStyle = "#FF0000";
	context.fillText(preWord, (canvas.width - stringWidth) / 2, (canvas.height + textSize / 2) / 2);
	context.fillStyle = "#000000";
	context.fillText(postWord, (canvas.width - stringWidth) / 2 + preWidth, (canvas.height + textSize / 2) / 2);

	// draw the upcoming words
	context.font = upcomingSize + "px Arial";
	context.fillStyle = "#777777";

	var coming = "";
	for (var i = wordIndex + 1; context.measureText(coming).width < canvas.width / 2; i++)
	{
		if (i == gameData.words.length) i = 0;
		coming = coming + " " + gameData.words[i].toUpperCase();
	}

	var shift = 2 * (wordScale - 1) * context.measureText(gameData.words[wordIndex]).width;
	context.fillText(coming, canvas.width / 2 + shift, canvas.height / 2 + canvas.height / 10 + upcomingSize / 2);

	// draw bottom bar
	const percent = wordIndex * 1.0 / gameData.words.length; // list progress
	context.fillStyle = "#FF0000";
	context.fillRect(0, canvas.height * 97.0 / 100.0, canvas.width * percent, canvas.height);

	// draw top bar
	const statusTextSize = canvas.height * 0.03;
	var statusText = "";
	var timePercent;
	if (gameData.use_timelimit)
	{	// level has a timelimit
		statusText = "TIME LEFT: " + parseFloat(millisecondsLeft / 1000.0).toFixed(2) + "s";
		timePercent = millisecondsLeft * 0.001 / gameData.max_time_accumulated;
	}
	else 
	{	// no timelimit
		statusText = "NO TIMELIMIT";
		timePercent = 1.0;
	}

	context.fillStyle = "#FF0000";
	context.fillRect(0, 0, canvas.width * timePercent, statusTextSize * 1.25); // draw bar
	context.font = statusTextSize + "px Arial";
	context.fillStyle = "#000000";
	context.fillText(statusText, (canvas.width - context.measureText(statusText).width) / 2, statusTextSize); // draw status text
	
	if (!connectionStatus.connected)
	{	// dropped from a server
		context.fillText(connectionStatus.message, (canvas.width - context.measureText(connectionStatus.message).width) / 2, canvas.height - 5);
	}

	wordScale = (wordScale + 1.0) / 2.0;
}

/****************************************************************
 * Main game input function: Handles typing and exiting the game
 ****************************************************************/
function mainGameInput(e)
{
	const word = gameData.words[wordIndex];

	switch(e.key.toUpperCase())
	{
		case "ESCAPE":	
			loadScoreScreen();

			break;
		default:
			socket.emit("gameAction", { type: "key", value: e.key.toUpperCase() , delta: timeTotal });

			if (e.key.toUpperCase() == word.toUpperCase().charAt(letterIndex)) // remove case-sensitivity
			{	// right letter
				if (letterIndex == word.length - 1)
				{	// last letter in the word, move on to the next
					if (wordIndex == gameData.words.length - 1) wordIndex = 0;
					else wordIndex++;

					letterIndex = 0;

					// add time
					millisecondsLeft = parseInt(millisecondsLeft + gameData.time_per_symbol * word.length * 1000);
					if (millisecondsLeft > gameData.max_time_accumulated * 1000) 
						millisecondsLeft = parseInt(gameData.max_time_accumulated * 1000); 

					// add score
					wordScore++;
					symbolScore += word.length;

					wordScale = 1.5;
				}
				else letterIndex++; // add current word progress
			}
			else letterIndex = 0; // wrong letter, reset current word progress
			break;
	}
}

/*************************************************
 * Score screen render function: Shows the score, 
 * level title, and, of course, "GAME OVER"
 *************************************************/
function scoreRenderer()
{
	context.clearRect(0, 0, canvas.width, canvas.height);

	const gameOverHeight = canvas.height / 6 * wordScale;
	const gameOverMessage = "GAME OVER";
	context.font = gameOverHeight + "px Arial";

	// draw moving level title
	context.fillStyle = "#AAAAAA";
	context.fillText(gameData.title.toUpperCase(), (canvas.width - (1 + Math.sin(frame / 500)) * context.measureText(gameData.title.toUpperCase()).width) / 2, gameOverHeight);

	// draw "GAME OVER"
	context.fillStyle = "#FF0000";
	const y = (canvas.height + gameOverHeight / 2) / 2;
	context.fillText(gameOverMessage, (canvas.width - context.measureText(gameOverMessage).width) / 2, y);

	const secondaryHeight = gameOverHeight / 4;
	context.font = secondaryHeight + "px Arial";
	context.fillStyle = "#000000";

	// draw score
	const scoreMessage = "WORDS: " + wordScore + "/" + gameData.words.length + " | SYMBOLS: " + symbolScore + " | SYMBOLS PER SECOND: " + (symbolScore * 1000 / timeTotal).toFixed(2);
	context.fillText(scoreMessage, (canvas.width - context.measureText(scoreMessage).width) / 2, y - gameOverHeight);

	if (scoreboardReady)
	{	// draw highscores
		const scoreboardMessage = "MAX SYMBOLS PER SECOND: " + scoreboard.symPerSec + " by " + scoreboard.symPerSecHolder + " | MAX WORDS: " + scoreboard.words + " by " + scoreboard.wordsHolder;
		context.fillText(scoreboardMessage, (canvas.width - context.measureText(scoreboardMessage).width) / 2, y + secondaryHeight * 2); 
	}

	// draw helper message
	context.fillStyle = "#777777";
	const pressMessage = "<ENTER> = RETURN TO SELECTION, <R> = RETRY";
	context.fillText(pressMessage, (canvas.width - context.measureText(pressMessage).width) / 2, canvas.height - 10); 

	wordScale = (wordScale + 1.0) / 2;
}

/***************************************************************
 * Score screen input function: <ENTER> to return, <R> to retry
 ***************************************************************/
function scoreInput(e)
{
	switch (e.key.toUpperCase())
	{
		case "ENTER":
			loadFilePicker();
			break;

		case "R":
			// reset game stats
			wordIndex = 0;
			letterIndex = 0;
			wordScore = 0;
			symbolScore = 0;
			timeTotal = 0;

			millisecondsLeft = parseInt(gameData.initial_time * 1000);
		
			// roll out the game
			renderFunction = prepareRenderer;
			inputFunction = prepareInput;

			wordScale = 1.5;

			runRendererAndInput();
			break;
	}
}

/**********************************************************
 * Initializes the game and recieves game data from server
 **********************************************************/
function init()
{
	// resize canvas
	init_canvas();
	
	// get game data files list
	console.log("Connecting to a server...");
	socket.emit("requestGameDataFiles", null);

	socket.on("recieveGameDataFiles", function(data)
	{
		console.log("Server responded to me (he's not happy):");

		data.forEach(function(element)
		{
			console.log(element.title + " in " + element.file);
		});

		gamedatafiles = data;
	});

	socket.on("recieveScoreboard", function(data)
	{
		console.log(data);
		scoreboardReady = true;
		scoreboard = data;
	});

	socket.on("sessionAddSuccess", function(data) { socket.emit("clientPong", null); connectionStatus.connected = true; });
	
	socket.on("sessionRemoved", function(data) 
	{
		timeTotal = data.time;
		connectionStatus.connected = false; 
		connectionStatus.message = data.reason; 
		wordScore = data.score.words;
		symbolScore = data.score.symbols;
	});

	socket.on("adjustTime", function(data) { console.log("Delta: " + data.deltaTime); adjustTime(data.deltaTime); });
}

window.onresize = init_canvas;

init(); // initialize the game

username = window.sessionStorage.getItem("wordsUsername");
if (!username)
{
	username = prompt("Select yourself a username", "");
	if (username) window.sessionStorage.setItem("wordsUsername", username); // don't remember if something went wrong
}

loadMainMenu();
})();
