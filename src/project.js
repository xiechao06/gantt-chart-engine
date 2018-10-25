import Task from './task'

function _clearTask (json, fields) {
  for (let it of fields) {
    delete json[it]
  }
  for (let t of json.subTasks) {
    _clearTask(t, fields)
  }
}

class Project extends Task {
  get canonicalName () {
    return []
  }

  get baseline () {
    let json = this.toJSON()
    _clearTask(json, ['startAt', 'startArg', 'finishAt', 'finishArg'])
    return new Project().fromJSON(json)
  }

  toJSON () {
    return Object.assign(super.toJSON(), {
      base: this.base()
    })
  }

  fromJSON (arg) {
    super.fromJSON(arg)
    this.base(arg.base)
    return this
  }

  clone () {
    return new Project().fromJSON(this.toJSON())
  }
}

export default Project
