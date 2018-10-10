export class GanttInvalidOp extends Error {
  constructor (op) {
    super('invalid operaion: ' + op)
  }
}
