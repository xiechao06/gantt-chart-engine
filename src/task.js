import { GanttInvalidOp } from './errors'
import timestring from 'timestring'
import isEmpty from 'is-empty'
import isVarName from 'is-var-name'
import arrayStartsWith from 'array-starts-with'

function taskError (taskName, tpl) {
  if (taskName instanceof Task) {
    taskName = taskName.canonicalName
  }
  taskName = '[' + [].concat(taskName).map(it => `'${it}'`).join(', ') + ']'
  return new Error(tpl(taskName))
}

function clone (o) {
  if (Array.isArray(o)) {
    return o.slice(0)
  }
  if (typeof o === 'object') {
    return Object.assign({}, o)
  }
  return o
}

class Task {
  constructor (name, parent) {
    name && this.name(name)
    this._parent = parent
    this._onStartCbs = []
    this._onFinishCbs = []
    this._subTasks = []
    this._dependsUpon = []
    this._level = parent ? parent.level + 1 : 0
    this._expectedTimeSpan = 0
    this._base = 0
    this.$ = this.find
    this.duration = this.expectedTimeSpan
  }

  clone (parent) {
    return new Task().from(this, parent)
  }

  from (task, parent) {
    this._name = task._name
    this._parent = parent
    this._onStartCbs = task._onStartCbs.slice(0)
    this._onFinishCbs = task._onFinishCbs.slice(0)
    this._subTasks = task._subTasks.map(it => new Task().from(it, this))
    this._dependsUpon = task._dependsUpon.slice(0)
    this._level = task._level
    this._expectedTimeSpan = task._expectedTimeSpan
    this._base = task._base
    this._bundle = clone(task._bundle)
    this._label = task._label
    this._startAt = task._startAt
    this._finishAt = task._finishAt
    this._startArg = clone(task._startArg)
    this._finishArg = clone(task._finishArg)
    return this
  }

  get level () {
    return this._level
  }

  get isLeaf () {
    return isEmpty(this._subTasks)
  }

  get root () {
    return this._parent ? this._parent.root : this
  }

  get progress () {
    if (this.finishAt()) {
      return 1
    }
    if (this.startAt()) {
      return 0
    }
  }

  base (arg) {
    if (arg === void 0) {
      return this._base
    }
    this._base = new Date(arg).getTime()
    return this
  }

  name (arg) {
    if (arg === void 0) {
      return this._name
    }
    if (!isVarName(arg)) {
      throw new Error('invalid task name ' + arg + ', should use a valid javascript identifier name')
    }
    this._name = arg
    return this
  }

  bundle (arg) {
    if (arg === void 0) {
      return this._bundle
    }
    this._bundle = arg
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

  addSubTask (arg) {
    let task
    if (arg instanceof Task) {
      task = arg
    } else {
      if (typeof arg === 'function') {
        task = new Task('', this)
      } else if (typeof arg === 'string') {
        task = new Task(arg, this)
      } else {
        throw new Error('task must be a function or string')
      }
    }
    if (this._subTasks.hasOwnProperty(task.name())) {
      throw new Error('task ' + task.name() + ' already exists')
    }
    this._subTasks.push(task)
    // add at first, then apply function, otherwise sub task can't depends upon
    // some tasks
    if (typeof arg === 'function') {
      arg(task)
    }
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

  get plainDependsUpon () {
    return this._dependsUpon
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
      let task
      if (n === '~') {
        // find previous siblings
        let subTasks = this._parent.subTasks
        // previous to me or the last children of my parent
        for (var i = 0; i < subTasks.length && subTasks[i] !== this; ++i) {
        }
        task = subTasks[i - 1]
        if (!task) {
          throw Error('no previous sibling to depends upon')
        }
      } else {
        task = root.$(n)
        if (!task) {
          throw taskError(n, n => `no such task: ${n}`)
        }
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
   * it will equal to startAt when it is started
   * */
  get expectedToStartAt () {
    if (this.isLeaf) {
      let startAt = this.startAt()
      if (startAt) {
        return startAt
      }
      let dependsUpon = this.getDependsUpon()
      if (isEmpty(dependsUpon)) {
        return this.root.base()
      }
      return Math.max(...this.getDependsUpon().map(it => it.expectedToFinishAt))
    }
    return Math.min(...this.subTasks.map(it => it.expectedToStartAt))
  }

  start (args) {
    return this.startAt(new Date(), args)
  }

  startAt (t) {
    if (this.isLeaf) {
      if (t === void 0) {
        return this._startAt
      }
      if (!(typeof t === 'string' || typeof t === 'number' || t instanceof Date)) {
        throw Error(t + ' should be string or number')
      }
      this._startAt = new Date(t).getTime()
    } else {
      if (t === void 0) {
        let startedTasks = this._subTasks.filter(it => it.startAt() || it.finishAt())
        if (!startedTasks.length) {
          return
        }
        return Math.min.apply(null, startedTasks.map(it => it.startAt() || it.finishAt()))
      }
      throw Error('non-leaf task can not set start at')
    }
    return this
  }

  startArg (arg) {
    if (arg === void 0) {
      return this._startArg
    }
    this._startArg = arg
    return this
  }

  expectedTimeSpan (arg) {
    if (this.isLeaf) {
      if (arg === void 0) {
        if (this.finishAt()) {
          if (this.startAt()) {
            return this.finishAt() - this.startAt()
          }
          return 0
        }
        return this._expectedTimeSpan
      }
      this._expectedTimeSpan = typeof arg === 'string'
        ? timestring(arg, 'ms')
        : arg
    } else {
      if (arg === void 0) {
        return this.expectedToFinishAt - this.expectedToStartAt
      }
      throw new Error('non-leaf task can not set expected time span')
    }
    return this
  }

  finish (args) {
    return this.finishAt(new Date(), args)
  }

  finishAt (t) {
    if (this.isLeaf) {
      if (t === void 0) {
        return this._finishAt
      }
      if (!(typeof t === 'string' || typeof t === 'number' || t instanceof Date)) {
        throw Error(t + ' should be string or number')
      }
      this._finishAt = new Date(t).getTime()
    } else {
      if (t === void 0) {
        let finishedTasks = this._subTasks.filter(it => it.finishAt())
        if (finishedTasks.length < this._subTasks.length) {
          return null
        }
        return Math.max.apply(null, finishedTasks.map(it => it.finishAt()))
      }
      throw Error('non-leaf task can not set finish at')
    }
    return this
  }

  get expectedToFinishAt () {
    if (this.isLeaf) {
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

  opsFilter (arg) {
    this._opsFilter = arg
    return this
  }

  get ops () {
    if (!this.isLeaf ||
      !this.getDependsUpon().every(it => it.finishAt()) ||
      this._finishAt
    ) {
      return []
    }
    let ret = [Task.OP_START, Task.OP_FINISH]
    if (this._startAt) {
      ret = ret.slice(1)
    }
    if (this._opsFilter) {
      ret = this._opsFilter(ret)
    }
    return ret
  }

  async perform (action, arg) {
    if (!this.isLeaf) {
      throw new Error('you can\'t perform operation upon non-leaf task')
    }
    if (this.ops.indexOf(action) === -1) {
      throw new GanttInvalidOp(action)
    }
    action = {
      [Task.OP_START]: 'start',
      [Task.OP_FINISH]: 'finish'
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

  get depth () {
    if (this.isLeaf) {
      return 1
    }
    return Math.max(...this._subTasks.map(it => it.depth)) + 1
  }

  toJSON () {
    return {
      name: this.name(),
      bundle: this.bundle(),
      parent: (this._parent || {}).canonicalName,
      depth: this.depth,
      isLeaf: this.isLeaf,
      canonicalName: this.canonicalName,
      label: this.label(),
      subTasks: this.subTasks.map(it => it.toJSON()),
      plainDependsUpon: this._dependsUpon.map(it => it.canonicalName),
      dependsUpon: this.getDependsUpon().map(it => it.canonicalName),
      expectedToStartAt: this.expectedToStartAt,
      startAt: this.startAt(),
      startArg: this.startArg(),
      expectedTimeSpan: this.expectedTimeSpan(),
      duration: this.expectedTimeSpan(),
      finishAt: this.finishAt(),
      finishArg: this.finishArg(),
      expectedToFinishAt: this.expectedToFinishAt,
      description: this.description(),
      ops: this.ops,
      nextOp: this.nextOp,
      level: this.level
    }
  }

  fromJSON (arg) {
    for (let k of [
      'name', 'label', 'startAt', 'startArg', 'expectedTimeSpan', 'finishAt',
      'finishArg', 'description', 'bundle'
    ]) {
      arg[k] !== void 0 && arg[k] !== null && this[k](arg[k])
    }
    arg.subTasks &&
      arg.subTasks.length &&
      arg.subTasks.forEach(it => this.addSubTask(task => task.fromJSON(it)))
    arg.plainDependsUpon && arg.plainDependsUpon.length &&
      this.dependsUpon(...arg.plainDependsUpon)
    return this
  }

  get nextOp () {
    return (this.ops || [])[0]
  }
}

Task.OP_START = 'start'
Task.OP_FINISH = 'finish'

export default Task
