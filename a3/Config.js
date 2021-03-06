/*=====================================================
  Declared as literal object (All variables are static)	  
  =====================================================*/
var Config = {
	HEIGHT : 700,				// height of game window
	WIDTH : 1000,				// width of game window
	PORT : 4344,				// port of game
	FRAME_RATE : 40,			// frame rate 
	SERVER_NAME : "localhost",	// server name of game
	//SERVER_NAME : "172.28.176.122"	// server name of game

	//AOI
	GRID_WIDTH: 50,
	GRID_HEIGHT: 35,
	AOI_SQUARE_SIZE: 0,
	AOI_CROSS_SIZE1: 7,
	AOI_CROSS_SIZE2: 15
}


// For node.js require
global.Config = Config;

// vim:ts=4
