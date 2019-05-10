(function(){
var socket = io();
// form elements
var title_input = document.getElementById("title_input");
var use_timelimit_input = document.getElementById("use_timelimit_input");
var initial_time_input = document.getElementById("initial_time_input");
var max_time_accumulated_input = document.getElementById("max_time_accumulated_input");
var time_per_symbol_input = document.getElementById("time_per_symbol_input");
var words_input = document.getElementById("words_input");
var status_text = document.getElementById("status_text");

/*******************************
 * Checks if the input is valid
 *******************************/
function checkInput()
{
	var ret = true;

	const corruptColor = "red";
	const okColor = "grey";

	// check if everything is filled
	if (title_input.value.replace(" ", "") == "")
	{	// title is not empty
		title_input.style.borderColor = corruptColor;
		ret = false;
	} 
	else if (title_input.value.length > 40)
	{	// title is not too long
		title_input.style.borderColor = corruptColor;
		ret = false;
	}
	else title_input.style.borderColor = okColor;

	if ((initial_time_input.value == "") && (use_timelimit_input.checked))
	{
		initial_time_input.style.borderColor = corruptColor;
		ret = false;
	} else initial_time_input.style.borderColor = okColor;

	if ((max_time_accumulated_input.value == "") && (use_timelimit_input.checked))
	{
		max_time_accumulated_input.style.borderColor = corruptColor;
		ret = false;
	} else max_time_accumulated_input.style.borderColor = okColor;

	if ((time_per_symbol_input.value == "") && (use_timelimit_input.checked))
	{
		time_per_symbol_input.style.borderColor = corruptColor;
		ret = false;
	} else time_per_symbol_input.style.borderColor = okColor;

	if (words_input.value.replace(" ", "") == "")
	{
		words_input.style.borderColor = corruptColor;
		ret = false;
	} else words_input.style.borderColor = okColor;

	initial_time_input.disabled = !use_timelimit_input.checked;
	max_time_accumulated_input.disabled = !use_timelimit_input.checked;
	time_per_symbol_input.disabled = !use_timelimit_input.checked;

	return ret;
}

/**************
 * Exit action
 **************/
function exitAction()
{
	window.location.href = "/";
}

/***********************************************************
 * Send action: Checks the input and sends it to the server
 ***********************************************************/
function sendAction()
{
	if (!checkInput()) return;

	send_button.disabled = true;
	cancel_button.disabled = true;
	
	// construct an object
	const gameDataObject =
	{
		title: title_input.value,
		use_timelimit: use_timelimit_input.checked,
		initial_time: parseFloat(initial_time_input.value),
		max_time_accumulated: parseFloat(max_time_accumulated_input.value),
		time_per_symbol: parseFloat(time_per_symbol_input.value),
		words: words_input.value.split('\n')
	};

	const jsonString = JSON.stringify(gameDataObject);

	console.log("Game Data:\n" + jsonString);

	socket.emit("submitLevel", gameDataObject);
}

/*********************************************************
 * Reacts to the submission result returned from a server
 *********************************************************/
function onResult(data)
{
	send_button.disabled = false;
	cancel_button.disabled = false;

	if (data.result) status_text.style.color = "green";
	else status_text.style.color = "red";
	status_text.value = data.desc;
}

/********************************
 * Input handler for the creator
 ********************************/
function creatorInput(e)
{
	switch (e.key)
	{
		case "Escape":
			exitAction();
			break;
	}
}

document.addEventListener("keydown", creatorInput, false); // start input listener
document.getElementById("cancel_button").onclick = exitAction; // bind exit button
document.getElementById("send_button").onclick = sendAction; // bind send action

socket.on("submissionResult", onResult);

setInterval(checkInput, 10);
})();
