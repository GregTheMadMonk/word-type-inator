# Creating gamedata for Word-Type-Inator
Gamedata is stored in .json files. File syntax:
```json
{
	"title": "File Title",
	"use_timelimit": true,
 	"intial_time": 10,
	"max_time_accumulated": 10,
	"time_per_symbol": 0.1,
	"words": [
		"an",
		"array",
		"of",
		"words",
		"strings divided with spaces are also allowed"
	]
}
```
## What does it do?
### title
Basically, a name you give to your level
### use_timelimit
`true` or `false`, whether or not you want to have time limit
### initial_time
Time initialliy given to player (in seconds)
### max_time_accumulated
Maximum amount of time left player can have
### time_per_symbol
amount of time given per symbol after successfully typing a word
### words
A sequence (array) of words. Strings with space as a separator also accepted as an array entry.
Yes. THAT simple.
