# 2048_Player

This program plays a game called 2048 using expectimax algorithm with following heuristics:
- Score: How much the game score increased
- Number of empty tiles: How many empty tiles are remaining
- Monotonicity: How monotonic the board is. That is, how well are the tiles arranged in descending order starting from the corner of the board.
- Smoothness: How close a tile's value is to each of its neighboring tile's value.

The javascript file consists of an implementation of the game and the decision making process.
There is also webpage demonstration included in the repository.

Note: webpage might become unresponsive if path evaluation iteration/search depth is too high. Be careful.

To do:
- Optimization (alpha-beta pruning).
- Reduce repeated code.
