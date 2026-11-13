/**
 * Evil mushroom sprites (20x18 ASCII pixel art, symmetrical so they can be mirrored freely).
 * Characters map to colours in Forest.PALETTE.
 */
(function (Forest) {
  // Mushroom Walk 1 (Perfect bilateral symmetry)
  const MUSHROOM_WALK_1 = [
    ".......mmmmmm.......",
    ".....mmRRRRRRmm.....",
    "...mmRRRRrRRRRRRmm...",
    "..mRRRRrrrrrrRRRRm..",
    ".mRRZZRRrrrrRRZZRRm.",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    "mRRNNNRRnnnnRRNNNRRm",
    "mRRnnnNRRRRRRnNNnRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "...ttteDTTTTDeTttt..",
    "...tttDDTTTTDDtttt..",
    "...tttWWDDDDWWtttt..",
    "....ttDDDDDDDDtt....",
    "....tttt....tttt....",
    "....KKKK....KKKK...."
  ];

  // Mushroom Walk 2 (Straight squashing hop)
  const MUSHROOM_WALK_2 = [
    "....................",
    ".......mmmmmm.......",
    ".....mmRRRRRRmm.....",
    "...mmRRRRrRRRRRRmm...",
    "..mRRZZRRrrrrRRZZRRm",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    "mRRNNNRRnnnnRRNNNRRm",
    "mRRnnnNRRRRRRnNNnRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "...ttteDTTTTDeTttt..",
    "...tttDDTTTTDDtttt..",
    "...tttWWDDDDWWtttt..",
    "....ttDDDDDDDDtt....",
    ".....tttt..tttt.....",
    ".....KKKK..KKKK....."
  ];

  // Mushroom Walk 3 (Straight stretch hop)
  const MUSHROOM_WALK_3 = [
    ".......mmmmmm.......",
    ".....mmRRRRRRmm.....",
    "...mmRRRRrRRRRRRmm...",
    "..mRRRRrrrrrrRRRRm..",
    ".mRRZZRRrrrrRRZZRRm.",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    "mRRNNNRRnnnnRRNNNRRm",
    "mRRnnnNRRRRRRnNNnRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "...ttteDTTTTDeTttt..",
    "...tttDDTTTTDDtttt..",
    "...tttWWDDDDWWtttt..",
    "....ttDDDDDDDDtt....",
    "...tttt......tttt...",
    "...KKKK......KKKK..."
  ];

  // Mushroom Walk 4 (Straight landing)
  const MUSHROOM_WALK_4 = [
    ".......mmmmmm.......",
    ".....mmRRRRRRmm.....",
    "...mmRRRRrRRRRRRmm...",
    "..mRRRRrrrrrrRRRRm..",
    ".mRRZZRRrrrrRRZZRRm.",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    "mRRNNNRRnnnnRRNNNRRm",
    "mRRnnnNRRRRRRnNNnRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "...ttteDTTTTDeTttt..",
    "...tttDDTTTTDDtttt..",
    "...tttWWDDDDWWtttt..",
    "....ttDDDDDDDDtt....",
    "....tttttttttttt....",
    "....KKKKKKKKKKKK...."
  ];

  // Mushroom Aggro (Symmetrical menacing teeth and glowing amber eyes)
  const MUSHROOM_AGGRO = [
    ".......mmmmmm.......",
    ".....mmRRRRRRmm.....",
    "...mmRRRRrRRRRRRmm...",
    "..mRRRRrrrrrrRRRRm..",
    ".mRRZZRRrrrrRRZZRRm.",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    "mRRNNNRRnnnnRRNNNRRm",
    "mRRnnnNRRRRRRnNNnRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "...tteeDDTTDDeeTtt..",
    "...tttDDDDDDDDtttt..",
    "..tttWDDDDDDDDWttt..",
    "..tttDWWDDDDWWDttt..",
    "....tttt....tttt....",
    "....KKKK....KKKK...."
  ];

  // Mushroom Hit State 1: Squash & Flash (Symmetrical shock, bulging eyes)
  const MUSHROOM_HIT_1 = [
    "....................",
    "....................",
    ".....mmmmmmmmmm.....",
    "...mmRRRRRRRRRRmm...",
    "..mRRZZRRrrrrRRZZRRm",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "..ttWWDDTTTTDDWWtt..",
    "..ttWDDWTTTTWDDWtt..",
    "..ttWWDDTTTTDDWWtt..",
    "...tttDDqqqqDDtttt..",
    "....ttDDqqqqDDtt....",
    ".....TTTTTTTTTT.....",
    "....tttt....tttt....",
    "....KKKK....KKKK...."
  ];

  // Mushroom Hit State 2: Dazed (Straight upright with spiral eyes @_@ and drool)
  const MUSHROOM_HIT_2 = [
    ".......mmmmmm.......",
    ".....mmRRRRRRmm.....",
    "...mmRRRRrRRRRRRmm...",
    "..mRRRRrrrrrrRRRRm..",
    ".mRRZZRRrrrrRRZZRRm.",
    ".mRRzzZZRRRRZZzzRRm.",
    "mRRRRRRRNNNNRRRRRRRm",
    "mRRNNNRRnnnnRRNNNRRm",
    "mRRnnnNRRRRRRnNNnRRm",
    ".uUUUUUUUUUUUUUUUUu.",
    "..uuUUUUUUUUUUUUuu..",
    "...tttTTTTTTTTttt...",
    "...tttDeDTTDeDtttt..",
    "...tttEDDTTEDDtttt..",
    "...tttqqqqqqqqtttt..",
    "....ttDqqqqqqDtt....",
    "....tttt....tttt....",
    "....KKKK....KKKK...."
  ];

  Forest.MushroomSprites = Object.freeze({
    walk: [MUSHROOM_WALK_1, MUSHROOM_WALK_2, MUSHROOM_WALK_3, MUSHROOM_WALK_4],
    aggro: MUSHROOM_AGGRO,
    squash: MUSHROOM_HIT_1,
    dazed: MUSHROOM_HIT_2
  });
})(window.Forest);
