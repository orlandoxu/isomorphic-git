import diff3Merge from 'diff3'

const JSONParse = function (str) {
  if (!str) {
    return {};
  }
  if(typeof str === 'object'){
    return str;
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
};

export function mergeNoteMeta({
  ourContent,
  baseContent,
  theirContent,
  // ourName = 'ours',
  // baseName = 'base',
  // theirName = 'theirs',
  // format = 'diff',
  // markerSize = 7,
}) {
  const cleanMerge = true
  let mergedText = ''

  const ourMeta = JSON.parse(ourContent)
  const baseMeta = JSON.parse(baseContent)
  const theirMeta = JSON.parse(theirContent)

  const ours = JSONParse(ourMeta)
  let base = JSONParse(baseMeta)
  const theirs = JSONParse(theirMeta)

  const changeOurs = deffJson(base, ours)
  const changeTheirs = deffJson(base, theirs)

  // Step 1. 检查双方删掉的(一方删了，另一方未改动）
  for (const iter in changeOurs.removed) {
    if (changeTheirs.removed[iter] || !changeTheirs.modifyed[iter]) { // 对方未改动 或者也删除了
      delete base[iter]
    }
  }

  for (const iter in changeTheirs.removed) {
    if (changeOurs.removed[iter] || !changeOurs.modifyed[iter]) {     // 对方未改动 或者也删除了
      delete base[iter]
    }
  }

  // Step 2. 检查双方添加的
  for (const iter in changeOurs.added) {
    base[iter] = changeOurs.added[iter]
  }

  for (const iter in changeTheirs.added) {
    base[iter] = changeTheirs.added[iter]
  }

  // Step 3. 检查双方修改的
  for (const iter in changeOurs.modifyed) {
    if (changeTheirs.modifyed[iter]) {  // 如果双方都修改了
      base[iter] = (changeOurs.modifyed[iter].modifyTime > changeTheirs.modifyed[iter].modifyTime ?
        changeOurs.modifyed[iter] : changeTheirs.modifyed[iter])
    }

    // 如果对方删除了，删除无效
    // 不存在一方添加，而一方修改的情况
    base[iter] = changeOurs.modifyed[iter]
  }

  for (const iter in changeTheirs.modifyed) {
    if (changeOurs.modifyed[iter]) {  // 如果双方都修改了
      continue  // 双方都修改了的情况只需要执行一次
    }

    // 如果对方删除了，删除无效
    // 不存在一方添加，而一方修改的情况
    base[iter] = changeTheirs.modifyed[iter]
  }
  base = base || {}
  mergedText = JSON.stringify(base)
  return { cleanMerge, mergedText }
}

/**
 * @param base
 * @param line
 * @returns {{removed: {}, added: {}, modifyed: {}}}
 */
function deffJson(base, line) {
  base = base || {}
  line = line || {}

  const removed = {}
  const modifyed = {}
  const added = {}

  for (const iter in base) {
    if (!line[iter]) {    // 删除的
      removed[iter] = base[iter]
      continue
    }

    base[iter].modifyTime = base[iter].modifyTime || 0
    line[iter].modifyTime = line[iter].modifyTime || 0
    if (line[iter].modifyTime > base[iter].modifyTime) {
      // 进行了修改
      modifyed[iter] = line[iter]
      continue
    }
  }

  for (const iter in line) {
    if (!base[iter]) {
      added[iter] = line[iter]
    }
  }

  return {removed, modifyed, added}
}
