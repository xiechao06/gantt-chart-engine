import Task from './task'

function _clearTask (task, fields) {
  for (let it of fields) {
    delete task[it]
  }
  for (let t of task.subTasks) {
    _clearTask(t, fields)
  }
}

class Project extends Task {
  get canonicalName () {
    return []
  }

  get baseline () {
    let ret = this.clone()
    _clearTask(ret, ['_startAt', '_startArg', '_finishAt', '_finishArg'])
    return ret
  }

  toJSON () {
    return Object.assign(super.toJSON(), {
      base: this.base()
    })
  }

  clone () {
    return new Project().from(this)
  }

  fromJSON (arg) {
    super.fromJSON(arg)
    this.base(arg.base)
    return this
  }
}

export default Project
