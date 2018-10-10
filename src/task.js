import { GanttInvalidOp } from './errors'
import timestring from 'timestring'
import isEmpty from 'is-empty'
import isVarName from 'is-var-name'
import arrayStartsWith from 'array-starts-with'

function taskError (taskName, tpl) {
  if (taskName instanceof Task) {
    taskName = taskName.canonicalName
  }
  taskName = '[' + [].concat(taskName).map(it => `'${it}'`).join(',') + ']'
  return new Error(tpl(taskName))
}

function defaultOpsFunc () {
  return [Task.ACTION_START, Task.ACTION_FINISH]
}

class Task {
  constructor (name, parent, {
    opsFunc = defaultOpsFunc,
    canonicalNameincludeRoot = false
  } = {}) {
    name && this.name(name)
    this._parent = parent
    this._opts = {
      opsFunc,
      canonicalNameincludeRoot
    }
    this._onStartCbs = []
    this._onFinishCbs = []
    this._subTasks = []
    this._dependsUpon = []
    this.$ = this.find
  }

  isLeaf () {
    return isEmpty(this._subTasks)
  }

  get root () {
    return this._parent ? this._parent.root : this
  }

  name (arg) {
    if (arg === void 0) {
      return this._name
    }
    if (!isVarName(arg)) {
      throw new Error('invalid task name, should use a valid javascript identifier name')
    }
    this._name = arg
    return this
  }

  get canonicalName () {
    return (this._parent ? this._parent.canonicalName : [])
      .concat(this._name)
  }

  label (labelArg) {
    if (labelArg === void 0) {
      return this._label || this._name
    }
    this._label = labelArg
    return this
  }

  get subTasks () {
    return this._subTasks
  }

  addSubTask (task) {
    if (!(task instanceof Task)) {
      if (typeof task === 'function') {
        task = task(new Task('', this))
      } else if (typeof task === 'string') {
        task = new Task(task, this)
      } else {
        throw new Error('task must be a function or string')
      }
    }
    if (this._subTasks.hasOwnProperty(task.name())) {
      throw new Error('task ' + task.name() + ' already exists')
    }
    this._subTasks.push(task)
    return this
  }

  find (taskName, updateFunc) {
    return this._findIter(taskName, updateFunc, this)
  }

  _findIter (taskName, updateFunc, root) {
    let taskNames = [].concat(taskName)
    if (taskNames.length === 0) {
      if (typeof updateFunc === 'function') {
        updateFunc.apply(root, [this])
      }
      return this
    }
    let idx = this._subTasks.map(it => it._name).indexOf(taskNames[0])
    if (idx === -1) {
      return null
    }
    return this._subTasks[idx].find(taskNames.slice(1), updateFunc, root)
  }

  moveSubTask (taskName, before) {
    let subTaskNames = this._subTasks.map(it => it.name())
    let fromIdx = subTaskNames.indexOf(taskName)
    if (fromIdx === -1) {
      throw taskError(taskName, n => `no such task: ${n}`)
    }
    let toIdx = before ? subTaskNames.indexOf(before) : subTaskNames.length - 1
    if (toIdx === -1) {
      throw taskError(taskName, n => `no such task: ${n}`)
    }
    let subTask = this._subTasks.splice(fromIdx, 1)[0]
    this._subTasks.splice(toIdx, 0, subTask)
    return this
  }

  removeSubTask (taskName) {
    let subTasks = this._subTasks.filter(it => it.name() !== taskName)
    if (subTasks.length === this._subTasks.length) {
      throw new Error('no such task: ' + taskName)
    }
    this._subTasks = subTasks
    return this
  }

  isMyAncestor (task) {
    if (task instanceof Task) {
      task = task.canonicalName
    }
    let myCanonicalName = this.canonicalName
    for (let i = 0; i < task.length; ++i) {
      if (task[i] !== myCanonicalName[i]) {
        return false
      }
    }
    return true
  }

  getDependsUpon () {
    if (!this._parent) {
      return []
    }
    let dependsUpon = this._parent
      .getDependsUpon()
      .concat(this._dependsUpon)
      // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
      // array of array could be sorted
      .map(it => it.canonicalName)
      .sort()
    if (!dependsUpon.length) {
      return []
    }
    let pivot = dependsUpon[0]
    let ret = [pivot]
    let i = 0
    while (i < dependsUpon.length) {
      if (!arrayStartsWith(dependsUpon[i], pivot)) {
        pivot = dependsUpon[i]
        ret.push(pivot)
      }
      ++i
    }
    let root = this.root
    return ret.map(it => root.$(it))
  }

  doesDependUpon (task) {
    if (task instanceof Task) {
      task = task.canonicalName
    }
    return this.getDependsUpon()
      .some(it => arrayStartsWith(task, it.canonicalName))
  }

  /**
   * 设定依赖关系，并可能根据依赖关系调整expectedToStartAt
   * */
  dependsUpon (...canonicalNames) {
    if (canonicalNames.length === 0) {
      return this.getDependsUpon()
    }
    canonicalNames = canonicalNames.map(
      it => it instanceof Task
        ? it.canonicalName
        : it
    )
    let dependsUpon = []
    let root = this.root
    for (let n of canonicalNames) {
      let task = root.find(n)
      if (!task) {
        throw taskError(n, n => `no such task: ${n}`)
      }
      if (this === task) {
        throw taskError(n, n => `can not depends upon self: ${n}`)
      }
      if (this.isMyAncestor(task)) {
        throw taskError(n, n => `can not depends upon ancestor: ${n}`)
      }
      if (this.doesDependUpon(task)) {
        throw taskError(n, n => `already depends upon task ${n}`)
      }
      if (task.doesDependUpon(this)) {
        throw taskError(n, n => `depends upon a task ${n} which depends on myself (cylic dependent)`)
      }
      dependsUpon.push(task)
    }
    this._dependsUpon = this._dependsUpon.concat(dependsUpon)
    return this
  }

  removeDependsUpon (...canonicalNames) {
    canonicalNames = new Set(
      canonicalNames.map(
        it => it instanceof Task
          ? it.canonicalName
          : it
      ).map(it => it.join('.')))
    this._dependsUpon = this._dependsUpon.filter(it => !canonicalNames.has(it.canonicalName.join('.')))
    return this
  }

  /**
   * when this task is expected to start at.
   * it has nothing to do with the
   * actual progressing
   * */
  get expectedToStartAt () {
    return Math.max.apply(null, this.getDependsUpon().map(it => it.expectedToFinishAt).concat(0))
  }

  start (args) {
    return this.startAt(new Date(), args)
  }

  startAt (t) {
    if (this.isLeaf()) {
      if (t === void 0) {
        return this._startAt
      }
      this._startAt = new Date(t).getTime()
    } else {
      if (t === void 0) {
        let startedTasks = this._subTasks.filter(it => it.startAt() !== void 0)
        if (!startedTasks.length) {
          return
        }
        return Math.min.apply(null, startedTasks.map(it => it.startAt()))
      }
      throw Error('non-leaf task can not set start at')
    }
    return this
  }

  startArg (arg) {
    if (arg === void 0) {
      return this._startArg
    }
    this._startArg = typeof arg === 'string'
      ? timestring(arg, 'ms')
      : arg
    return this
  }

  expectedTimeSpan (arg) {
    if (this.isLeaf()) {
      if (arg === void 0) {
        return this._expectedTimeSpan
      }
      this._expectedTimeSpan = typeof arg === 'string'
        ? timestring(arg, 'ms')
        : arg
    } else {
      if (arg === void 0) {
        return this.expectedToFinishAt() - this.expectedToStartAt()
      }
      throw new Error('non-leaf task can not set expected time span')
    }
    return this
  }

  finish (args) {
    return this.finishAt(new Date(), args)
  }

  finishAt (t) {
    if (this.isLeaf()) {
      if (t === void 0) {
        return this._finishAt
      }
      this._finishAt = new Date(t).getTime()
    } else {
      if (t === void 0) {
        let finishedTasks = this._subTasks.filter(it => it.finishAt() !== void 0)
        if (!finishedTasks.length) {
          return
        }
        return Math.max.apply(null, finishedTasks.map(it => it.finishAt()))
      }
      throw Error('non-leaf task can not set finish at')
    }
    return this
  }

  get expectedToFinishAt () {
    if (this.isLeaf()) {
      return this._finishAt ||
        ((this.startAt() || this.expectedToStartAt) + this._expectedTimeSpan)
    }
    return Math.max.apply(null, this._subTasks.map(it => it.expectedToFinishAt))
  }

  description (arg) {
    if (arg === void 0) {
      return this._description
    }
    this._description = arg
    return this
  }

  finishArg (arg) {
    if (arg === void 0) {
      return this._finishArg
    }
    this._finishArg = arg
    return this
  }

  get ops () {
    return this._opts.opsFunc.apply(this)
  }

  async perform (action, arg) {
    if (this.ops.indexOf(action) === -1) {
      throw new GanttInvalidOp(action)
    }
    action = {
      [Task.ACTION_START]: 'start',
      [Task.ACTION_FINISH]: 'finish'
    }[action]
    ;(this[action])(arg)
    if (action === 'start') {
      for (let cb of this._onStartCbs) {
        await cb.call(this)
      }
    } else if (action === 'finish') {
      for (let cb of this._onFinishCbs) {
        await cb.call(this)
      }
    }
  }

  onStart (arg) {
    this._onStartCbs.push(arg)
    return this
  }

  onFinish (arg) {
    this._onFinishCbs.push(arg)
    return this
  }
}

Task.ACTION_START = Symbol('TASK_ACTION_START')
Task.ACTION_FINISH = Symbol('TASK_ACTION_FINISH')

export default Task
