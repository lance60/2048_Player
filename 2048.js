// TILE_SPAWN_TABLE.length must always equal TILE_SPAWN_RATE.length
// Each tile must have corresponding spawn rate
const TILE_SPAWN_TABLE = [2, 4];
const TILE_SPAWN_RATE = [90, 10];
const WINNING_TILE = 2048;

// Custom datatypes
class Coordinate
{
	constructor(x, y)
	{
		this.x = x;
		this.y = y;
	}
	
	getDistance(otherCoord)
	{
		return Math.sqrt(Math.pow(otherCoord.x - this.x, 2) + Math.pow(otherCoord.y - this.y, 2));
	}
}

const Direction = {
		NONE: Object.freeze({index: -1, string: "None"}),
		UP: Object.freeze({index: 0, string: "Up"}),
		DOWN: Object.freeze({index: 1, string: "Down"}),
		LEFT: Object.freeze({index: 2, string: "Left"}),
		RIGHT: Object.freeze({index: 3, string: "Right"}),
	};
Object.freeze(Direction);

const DIRECTION_LIST = Object.freeze([Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]);

class MoveData
{
	constructor(direction)
	{
		this.score = 0;
		this.isValidMove = false;
		this.direction = direction;
	}
}

class EvaluationSetting
{
	constructor(scoreWeight, emptyTileWeight, monotonicityWeight, roughnessPenaltyWeight, monotonicityRVal)
	{
		this.scoreWeight = scoreWeight;
		this.emptyTileWeight = emptyTileWeight;
		this.monotonicityWeight = monotonicityWeight;
		this.roughnessPenaltyWeight = roughnessPenaltyWeight;
		this.monotonicityRVal = monotonicityRVal;
	}
}

// Game implementation
class GameBoard
{
	constructor(width, height)
	{
		this.width = width;
		this.height = height;
		this.score = 0;
		this.moves = 0;
		this.cumulativeProbability = 0;
		this.hasWon = false;
		this.lastSpawnedTileCoord;
		this.emptyTileTable;
		this.boardState;
		
		for(let i = 0; i < TILE_SPAWN_RATE.length; i++)
		{
			this.cumulativeProbability += TILE_SPAWN_RATE[i];
		}
		
		this.initializeBoard();
		this.generateEmptyTileTable();
		this.spawnTile();
		this.spawnTile();
		
		this.lastSpawnedTileCoord = undefined;
	}
	
	static copyBoard(gameBoard)
	{
		let boardCopy = Object.create(GameBoard.prototype)
		
		boardCopy.width = gameBoard.width;
		boardCopy.height = gameBoard.height;
		boardCopy.score = gameBoard.score;
		boardCopy.moves = gameBoard.moves;
		boardCopy.cumulativeProbability = gameBoard.cumulativeProbability;
		boardCopy.hasWon = gameBoard.hasWon;
		boardCopy.lastSpawnedTileCoord = gameBoard.lastSpawnedTileCoord;
		
		boardCopy.boardState = [];
		
		for(let i = 0; i < boardCopy.width; i++)
		{
			boardCopy.boardState[i] = [];
		}
		
		for(let i = 0; i < boardCopy.width; i++)
		{
			for(let j = 0; j < boardCopy.height; j++)
			{
				boardCopy.boardState[i][j] = gameBoard.boardState[i][j];
			}
		}
		
		boardCopy.generateEmptyTileTable();
		
		return boardCopy
	}
	
	initializeBoard()
	{
		this.boardState = []
		
		for(let i = 0; i < this.width; i++)
		{
			this.boardState[i] = [];

			for(let j = 0; j < this.height; j++)
			{
				this.boardState[i][j] = 0;
			}
		}
	}
	
	generateEmptyTileTable()
	{
		this.emptyTileTable = [];
		
		for(let i = 0; i < this.width; i++)
		{
			for(let j = 0; j < this.height; j++)
			{
				if(this.boardState[i][j] == 0)
				{
					this.emptyTileTable.push(new Coordinate(i,j));
				}
			}
		}
	}
	
	generateTileValue()
	{
		let randomValue = Math.floor(Math.random() * this.cumulativeProbability);
		let rangeMin = 0
		
		for(let i = 0; i < TILE_SPAWN_TABLE.length - 1; i++)
		{
			let rangeMax = rangeMin + TILE_SPAWN_RATE[i];
			
			if(randomValue >= rangeMin && randomValue < rangeMax)
			{
				return TILE_SPAWN_TABLE[i];
			}
			
			rangeMin = rangeMax;
		}
		
		return TILE_SPAWN_TABLE[TILE_SPAWN_TABLE.length - 1];
	}
	
	isInBounds(coord)
	{
		return coord.x >= 0 && coord.x < this.width && coord.y >= 0 && coord.y < this.height;
	}
	
	grabTile(coord)
	{
		if(this.isInBounds(coord))
		{
			return this.boardState[coord.x][coord.y];
		}
		
		return undefined;
	}
	
	spawnTile()
	{
		let tileCoord = this.emptyTileTable[Math.floor(Math.random() * (this.emptyTileTable.length))];
		let tileValue = this.generateTileValue();
		
		this.boardState[tileCoord.x][tileCoord.y] = tileValue
		this.generateEmptyTileTable();
		this.lastSpawnedTileCoord = tileCoord;
	}
	
	shiftMovableTile(tileSet)
	{
		let score = 0;
		let offsetMin = 0;
		
		for(let i = 1; i < tileSet.length; i++)
		{
			if(tileSet[i] != 0)
			{
				let offset = i;
				
				let curTileValue = tileSet[i];
				tileSet[i] = 0;
				
				while(offset >= offsetMin && tileSet[offset] == 0)
				{
					offset--;
					
					if(tileSet[offset] != 0 || offset <= offsetMin)
					{
						if(tileSet[offset] <= 0 || tileSet[offset] == curTileValue)
						{
							if(tileSet[offset] == curTileValue)
							{
								score += tileSet[offset] + curTileValue;
								offsetMin++;
							}
							tileSet[offset] += curTileValue;
						}
						else
						{
							tileSet[offset + 1] = curTileValue;
						}
					}
				}
			}
		}
		
		return score;
	}
	
	// Not sure if combining all move function into one is good. Looks overloaded.
	move(direction)
	{
		if(this.isMovementPossible(direction))
		{
			let outerTraversalLimit = 0;
			let tileSetLength = 0;
			
			switch(direction.index)
			{
				case Direction.UP.index:
				case Direction.DOWN.index:
					outerTraversalLimit = this.width;
					tileSetLength = this.height;
					break;
				case Direction.LEFT.index:
				case Direction.RIGHT.index:
					outerTraversalLimit = this.height;
					tileSetLength = this.width;
					break;
			}
			
			for(let i = 0; i < outerTraversalLimit; i++)
			{
				let tileSet = [];
				
				for(let j = 0; j < tileSetLength; j++)
				{
					let curTileCoord;
					
					switch(direction.index)
					{
						case Direction.UP.index:
							curTileCoord = new Coordinate(i, j);
							break;
						case Direction.DOWN.index:
							curTileCoord = new Coordinate(i, tileSetLength - 1 - j)
							break;
						case Direction.LEFT.index:
							curTileCoord = new Coordinate(j, i);
							break;
						case Direction.RIGHT.index:
							curTileCoord = new Coordinate(tileSetLength - 1 - j, i);
							break;
					}
					
					tileSet.push(this.grabTile(curTileCoord));
				}
				
				this.score += this.shiftMovableTile(tileSet);
				
				for(let j = 0; j < tileSetLength; j++)
				{
					switch(direction.index)
					{
						case Direction.UP.index:
							this.boardState[i][j] = tileSet[j];
							break;
						case Direction.DOWN.index:
							this.boardState[i][tileSetLength - 1 - j] = tileSet[j];
							break;
						case Direction.LEFT.index:
							this.boardState[j][i] = tileSet[j];
							break;
						case Direction.RIGHT.index:
							this.boardState[tileSetLength - 1 - j][i] = tileSet[j];
							break;
					}
				}
			}
			
			if(!this.hasWon)
			{
				this.hasWon = this.hasTile(WINNING_TILE);
			}
			
			this.generateEmptyTileTable();
			this.spawnTile();
			this.moves++;
			
			return true;
		}
		
		return false;
	}
	
	canMove(tileCoord, direction)
	{
		let curTileVal = this.grabTile(tileCoord);
		let adjacentTileCoord;
		
		switch(direction.index)
		{
			case Direction.UP.index:
				adjacentTileCoord = new Coordinate(tileCoord.x, tileCoord.y - 1);
				break;
			case Direction.DOWN.index:
				adjacentTileCoord = new Coordinate(tileCoord.x, tileCoord.y + 1);
				break;
			case Direction.LEFT.index:
				adjacentTileCoord = new Coordinate(tileCoord.x - 1, tileCoord.y);
				break;
			case Direction.RIGHT.index:
				adjacentTileCoord = new Coordinate(tileCoord.x + 1, tileCoord.y);
				break;
			default:
				return false;
		}
		
		if(!this.isInBounds(adjacentTileCoord))
		{
			return false;
		}
		
		return this.grabTile(adjacentTileCoord) == 0 || this.grabTile(adjacentTileCoord) == curTileVal;
	}
	
	isMovementPossible(direction)
	{
		for(let i = 0; i < this.width; i++)
		{
			for(let j = 0; j < this.height; j++)
			{
				let curCoord = new Coordinate(i, j);
				if(this.grabTile(curCoord) != 0 && this.canMove(curCoord, direction))
				{
					return true;
				}
			}
		}
		
		return false;
	}
	
	isGameOver()
	{
		return !this.isMovementPossible(Direction.UP) &&
		!this.isMovementPossible(Direction.DOWN) &&
		!this.isMovementPossible(Direction.LEFT) &&
		!this.isMovementPossible(Direction.RIGHT);
	}
	
	hasTile(tile)
	{
		for(let i = 0; i < this.width; i++)
		{
			for(let j = 0; j < this.height; j++)
			{
				if(this.grabTile(new Coordinate(i,j)) == tile)
				{
					return true;
				}
			}
		}
		
		return false;
	}
}

// Board evaluation implementations
class BoardPossibility
{
	constructor(gameBoard, direction, evaluationSettings)
	{
		this.gameBoard = GameBoard.copyBoard(gameBoard);
		this.movementDirection = direction;
		this.isValidMove = this.gameBoard.move(direction);
		
		this.absoluteScore = this.gameBoard.score;
		this.numEmptyTiles = this.gameBoard.emptyTileTable.length;
		this.moveScore = this.calculateMoveScore(evaluationSettings);
	}
	
	getCoordOfHighestTile()
	{
		let coord = new Coordinate(0,0);
		let highestVal = this.gameBoard.grabTile(coord);
		
		for(let i = 0; i < this.gameBoard.width; i++)
		{
			for(let j = 0; j < this.gameBoard.height; j++)
			{
				let newCoord = new Coordinate(i,j);
				let newVal = this.gameBoard.grabTile(newCoord);
				
				if(newVal > highestVal)
				{
					highestVal = newVal;
					coord = newCoord;
				}
			}
		}
		return coord;
	}
	
	calculateRoughnessPenalty()
	{
		let penalty = 0;
		for(let i = 0; i < this.gameBoard.width; i++)
		{
			for(let j = 0; j < this.gameBoard.height; j++)
			{
				let curTile = this.gameBoard.grabTile(new Coordinate(i, j));
				
				if(curTile > 0)
				{
					let adjacentTiles = [
						this.gameBoard.grabTile(new Coordinate(i + 1, j)),
						this.gameBoard.grabTile(new Coordinate(i, j + 1))
					];
					
					for(let k = 0; k < adjacentTiles.length; k++)
					{
						if(adjacentTiles[k] != undefined && adjacentTiles[k] > 0)
						{
							penalty += Math.abs(Math.log2(curTile) - Math.log2(adjacentTiles[k]));
						}
					}
				}
			}
		}
		
		return penalty;
	}
	
	unfoldBoardVertical(otherSide, reversed)
	{
		let unfoldedBoard = [];
		let switchDir = reversed;
		
		for(let i = 0; i < this.gameBoard.width; i++)
		{
			for(let j = 0; j < this.gameBoard.height; j++)
			{
				let coord = new Coordinate(i, j);
				
				if(switchDir)
				{
					coord.y = this.gameBoard.height - j - 1;
				}
				
				if(otherSide)
				{
					coord.x = this.gameBoard.width - i - 1;
				}
				
				unfoldedBoard.push(this.gameBoard.grabTile(coord));
			}
			
			if(switchDir)
			{
				switchDir = false;
			}
			else
			{
				switchDir = true;
			}
		}
		
		return unfoldedBoard;
	}
	
	unfoldBoardHorizontal(otherSide, reversed)
	{
		let unfoldedBoard = [];
		let switchDir = reversed;
		
		for(let j = 0; j < this.gameBoard.height; j++)
		{
			for(let i = 0; i < this.gameBoard.width; i++)
			{
				let coord = new Coordinate(i, j);
				
				if(switchDir)
				{
					coord.x = this.gameBoard.width - i - 1;
				}
				
				if(otherSide)
				{
					coord.y = this.gameBoard.height - j - 1;
				}
				
				unfoldedBoard.push(this.gameBoard.grabTile(coord));
			}
			
			if(switchDir)
			{
				switchDir = false;
			}
			else
			{
				switchDir = true;
			}
		}
		
		return unfoldedBoard;
	}
	
	calculateOrderScore(order, rVal)
	{
		let score = 0;
		
		for(let i = 0; i < order.length; i++)
		{
			score += order[i] * Math.pow(rVal, i);
		}
		
		return score;
	}
	
	calculateMonotonicity(rVal)
	{
		let upperLeftPathOne = this.calculateOrderScore(this.unfoldBoardVertical(false, false), rVal);
		let upperLeftPathTwo = this.calculateOrderScore(this.unfoldBoardHorizontal(false, false), rVal);
		let upperRightPathOne = this.calculateOrderScore(this.unfoldBoardVertical(true, false), rVal);
		let upperRightPathTwo = this.calculateOrderScore(this.unfoldBoardHorizontal(false, true), rVal);
		let lowerLeftPathOne = this.calculateOrderScore(this.unfoldBoardVertical(false, true), rVal);
		let lowerLeftPathTwo = this.calculateOrderScore(this.unfoldBoardHorizontal(true, false), rVal);
		let lowerRightPathOne = this.calculateOrderScore(this.unfoldBoardVertical(true, true), rVal);
		let lowerRightPathTwo = this.calculateOrderScore(this.unfoldBoardHorizontal(true, true), rVal);
		
		return Math.max(upperLeftPathOne, upperLeftPathTwo, upperRightPathOne, upperRightPathTwo, lowerLeftPathOne, lowerLeftPathTwo, lowerRightPathOne, lowerRightPathTwo);
	}
	
	calculateMoveScore(evaluationSettings)
	{
		return (this.absoluteScore * evaluationSettings.scoreWeight) + 
		(this.numEmptyTiles * evaluationSettings.emptyTileWeight) + 
		(this.calculateMonotonicity(evaluationSettings.monotonicityRVal) * evaluationSettings.monotonicityWeight) - 
		(this.calculateRoughnessPenalty() * evaluationSettings.roughnessPenaltyWeight);
	}
	
}

// Functions for decision making process
function generateFutureStates(curBoard, evaluationSettings)
{
	let boardPossibilities = [];
	
	for(let i = 0; i < DIRECTION_LIST.length; i++)
	{
		boardPossibilities.push(new BoardPossibility(curBoard, DIRECTION_LIST[i], evaluationSettings));
	}
	
	return boardPossibilities;
	
}

function evaluatePossibilityPotential(boardPossibility, depth, evaluationSettings)
{
	if(!boardPossibility.isValidMove)
	{
		return -Infinity;
	}
	
	if(depth <= 0)
	{
		return boardPossibility.moveScore;
	}
	
	let futurePossibilities = generateFutureStates(boardPossibility.gameBoard, evaluationSettings);
	
	let possibilityPotential = -Infinity;
	
	for(let i = 0; i < futurePossibilities.length; i++)
	{
		let currentPossibilityPotential = evaluatePossibilityPotential(futurePossibilities[i], depth - 1, evaluationSettings);
		
		if(currentPossibilityPotential > possibilityPotential)
		{
			possibilityPotential = currentPossibilityPotential;
		}
	}
	
	return possibilityPotential;
}

// Evaluate move score based on different ways the tile could spawn after each move
function evaluateWeightedMoveScores(curBoard, numIter, depth, evaluationSettings)
{
	// 0 and negative numIter doesn't make sense.
	if(numIter < 1) numIter = 1;
	
	let moveDatas = [
		new MoveData(Direction.UP),
		new MoveData(Direction.DOWN),
		new MoveData(Direction.LEFT),
		new MoveData(Direction.RIGHT)
	];
	
	for(let i = 0; i < numIter; i++)
	{
		let futureStates = generateFutureStates(curBoard, evaluationSettings);
		
		for(let j = 0; j < futureStates.length; j++)
		{
			if(futureStates[j].isValidMove)
			{
				moveDatas[j].score += evaluatePossibilityPotential(futureStates[j], depth, evaluationSettings);
				moveDatas[j].isValidMove = true;
			}
		}
	}
	
	for(let i = 0; i < moveDatas.length; i++)
	{
		moveDatas[i].score /= numIter;
	}
	
	return moveDatas;
}

function makeBestMove(curBoard, numIter, depth, evaluationSettings)
{
	if(curBoard.isGameOver())
	{
		return Direction.NONE;
	}
	
	let moveDatas = evaluateWeightedMoveScores(curBoard, numIter, depth, evaluationSettings);

	// Select first valid move data
	let init = 0;
	
	while(init < moveDatas.length && !moveDatas[init].isValidMove)
	{
		init++;
	}
	
	// Guard against numIter < 1
	if(init >= moveDatas.length)
    {
		return Direction.NONE;
    }
	
	let bestMove = moveDatas[init];
	
	for(let i = init + 1; i < moveDatas.length; i++)
	{
		if(moveDatas[i].isValidMove && moveDatas[i].score > bestMove.score)
		{
			bestMove = moveDatas[i];
		}
	}
	
	curBoard.move(bestMove.direction);
	return bestMove.direction;
}
