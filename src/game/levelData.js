/** Layout of the forest level. Positions are in world units along the ground. */
(function (Forest) {
  Forest.LevelData = Object.freeze({
    playerStartX: 0,

    /** Large static oaks in front of the parallax background. */
    foregroundTrees: [
      { x: -7, scale: 1.35 },
      { x: 3, scale: 1.45 },
      { x: 13, scale: 1.3 },
      { x: 23, scale: 1.5 },
      { x: 34, scale: 1.4 },
      { x: 44, scale: 1.35 }
    ],

    /** Each mushroom patrols back and forth up to `patrolDistance` from its spawn point. */
    mushroomSpawns: [
      { x: 5.5, patrolDistance: 3.5 },
      { x: 16.0, patrolDistance: 4.5 },
      { x: 26.5, patrolDistance: 4.0 },
      { x: 38.0, patrolDistance: 5.0 }
    ]
  });
})(window.Forest);
