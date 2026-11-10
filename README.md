# 2048_Player

This program plays a game called 2048 using minimax + MCTS algorithm with following heuristics:
- Score: How much the game score increased
- Number of empty tiles: How many empty tiles are remaining
- Monotonicity: How monotonic the board is. That is, how well are the tiles arranged in descending order starting from the corner of the board.
- Smoothness: How close a tile's value is to each of its neighboring tile's value.

The javascript file consists of an implementation of the game and the decision making process.
There is also webpage demonstration included in the repository. You can try it [here](https://lance60.github.io/2048_Player/)

Note: webpage might become unresponsive if path evaluation iteration is too high. Be careful.

To do:
- Transition to proper expectimax decision model.
- Finetune heuristics to be more effective.
- fix makeBestMove to better handle a case where there's no more valid move.
	- Low priority fix because game over state (move possible?) is checked first before calling makeBestMove.
