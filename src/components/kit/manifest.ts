import { lanternKnight } from './art/knight-art';
import { postLandmarks, wardSkylines } from './art/post-landmark-art';
import { captainCrown, raiders } from './art/raider-art';
import { rankCastle, rankEmblemSprite } from './art/rank-art';
import {
  milestoneMedalSprite,
  moonSprite,
  shootingStarSprite,
  starShardSprite,
} from './art/reward-sprites';
import { wallHeroScenes } from './art/wall-art';
import { wallSurfaces, wallViewScene } from './art/wall-view-art';
import { boardJuice, praiseWords } from './recipes/board-juice';
import { raidCopy, raidRecipes } from './recipes/raid';
import { sessionEndRecipes, watchEndCopy } from './recipes/session-end';
import type { Manifest } from './types';

/**
 * The nightWatch kit: every role the watch draws, mapped to its art. To swap
 * a sprite, character or scene, add its file under `art/` and point the role
 * at it here (docs/specs/2026-10-18-watch-kit-design.md, "Swapping
 * something"); screens never name art files.
 */
export const nightWatch: Manifest = {
  name: 'nightWatch',
  sprites: {
    'reward.starShard': starShardSprite,
    'reward.shootingStar': shootingStarSprite,
    'reward.medal': milestoneMedalSprite,
    'character.raider.captain': captainCrown,
  },
  families: { 'reward.moon': moonSprite },
  emblems: {
    'reward.rankEmblem.page': (level) => rankEmblemSprite('page', level),
    'reward.rankEmblem.squire': (level) => rankEmblemSprite('squire', level),
    'reward.rankEmblem.knight': (level) => rankEmblemSprite('knight', level),
  },
  characters: {
    'character.knight': lanternKnight,
    'map.castle': rankCastle,
    ...raiders,
  },
  scenes: { 'scene.wallHero': wallHeroScenes },
  landmarks: postLandmarks,
  skylines: wardSkylines,
  recipes: { ...boardJuice, ...raidRecipes, ...sessionEndRecipes },
  copy: { praise: praiseWords, raid: raidCopy, watchEnd: watchEndCopy },
  views: { 'scene.wallView': wallViewScene },
  surfaces: {
    'ui.parchment': wallSurfaces.parchment,
    'ui.stoneButton': wallSurfaces.stoneButton,
    'ui.plaque': wallSurfaces.plaque,
  },
};
