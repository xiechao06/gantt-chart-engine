const should = require('should')
const { Task, Project } = require('./src/')
const dateformat = require('dateformat')
const ts = require('timestring')
const sinon = require('sinon')
const timestring = require('timestring')
require('should-sinon')

describe('leaf task', function () {
  let task

  beforeEach(function () {
    task = new Task()
  })

  it('is leaf', function () {
    task.isLeaf.should.be.exactly(true)
  })

  it('progress', function () {
    should(task.progress).be.exactly(void 0)
    task.startAt('2018-10-10')
    task.progress.should.be.exactly(0)
    task.finishAt('2018-10-10')
    task.progress.should.be.exactly(1)
  })

  it('level', function () {
    task.level.should.be.exactly(0)
  })

  it('name', function () {
    task.name('abc').name().should.be.exactly('abc')
  })

  it('bundle', function () {
    task.bundle('foo').bundle().should.be.exactly('foo')
  })

  it('depth', function () {
    task.depth.should.be.exactly(1)
  })

  it('canonicalName', function () {
    task.name('abc').canonicalName.should.deepEqual(['abc'])
  })

  it('label', function () {
    task.name('abc')
    task.label().should.be.exactly('abc')
    task.label('xyz').label().should.be.exactly('xyz')
  })

  it('startAt', function () {
    let startArg = { a: 'foo' }
    task.startAt('2018-09-20').startArg(startArg)
    dateformat(new Date(task.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-09-20')
    task.startArg().should.be.equal(startArg)
  })

  it('expectedTimeSpan', function () {
    task.expectedTimeSpan('1d').expectedTimeSpan().should.be.exactly(timestring('1d', 'ms'))
    task.startAt('2018-10-10').expectedTimeSpan().should.be.exactly(timestring('1d', 'ms'))
    task.finishAt('2018-10-11').expectedTimeSpan().should.be.exactly(timestring('1d', 'ms'))
  })

  it('finishAt', function () {
    task.finishAt('2018-10-01')
      .finishArg({ a: 'foo' })
    dateformat(new Date(task
      .finishAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')
    task.finishArg().a.should.be.exactly('foo')
  })

  it('expectedToFinishAt', function () {
    task.expectedTimeSpan('1d')
    task.expectedToFinishAt.should.be.exactly(ts('1d', 'ms'))
    task.startAt('2018-09-10')
    dateformat(new Date(task.expectedToFinishAt), 'yyyy-mm-dd').should.be.exactly('2018-09-11')
  })

  it('description', function () {
    let task = new Task().description('foo')
    task.description().should.exactly('foo')
  })

  it('perform', async function () {
    let startCb = sinon.spy()
    let finishCb = sinon.spy()
    task.onStart(startCb).onFinish(finishCb)
    await task.perform(Task.OP_START)
    startCb.should.be.calledOn(task)
    await task.perform(Task.OP_FINISH)
    finishCb.should.be.calledOn(task)
  })

  it('ops', async function () {
    task.ops.should.have.length(2)
    task.ops[0].should.be.exactly(Task.OP_START)
    task.opsFilter(ops => ops.slice(1)).ops.should.have.length(1)
  })
})

describe('non leaf task', function () {
  let a, aa, b, ba, bb, c, ca, caa, cab, project

  beforeEach(function () {
    project = new Project('project')
      .addSubTask(task => task
        .name('A')
        .addSubTask(task => task
          .name('AA')
        )
      )
      .addSubTask(task => task
        .name('B')
        .addSubTask(task => task
          .name('BA')
        )
        .addSubTask(task => task
          .name('BB')
        )
      )
      .addSubTask(task => task
        .name('C')
        .addSubTask(task => task
          .name('CA')
          .addSubTask(task => task
            .name('CAA')
          )
          .addSubTask(task => task
            .name('CAB')
          )
        )
      )

    a = project.$('A')
    aa = project.$(['A', 'AA'])
    b = project.$('B')
    ba = project.$(['B', 'BA'])
    bb = project.$(['B', 'BB'])
    c = project.$('C')
    ca = project.$(['C', 'CA'])
    caa = project.$(['C', 'CA', 'CAA'])
    cab = project.$(['C', 'CA', 'CAB'])
  })

  it('is leaf', function () {
    a.isLeaf.should.be.exactly(false)
  })

  it('base', function () {
    project.base('2018-10-10')
    dateformat(new Date(aa.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
    dateformat(new Date(bb.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
    dateformat(new Date(caa.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
    dateformat(new Date(cab.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
    dateformat(new Date(a.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
    b.dependsUpon(aa.expectedTimeSpan('2d'))
    dateformat(new Date(b.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-12')
  })

  it('level', function () {
    a.level.should.be.exactly(1)
    aa.level.should.be.exactly(2)
    caa.level.should.be.exactly(3)
  })

  it('depth', function () {
    a.depth.should.be.exactly(2)
    b.depth.should.be.exactly(2)
    c.depth.should.be.exactly(3)
  })

  it('canonicalName', function () {
    a.canonicalName.should.deepEqual(['A'])
    aa.canonicalName.should.deepEqual(['A', 'AA'])
    ca.canonicalName.should.deepEqual(['C', 'CA'])
    caa.canonicalName.should.deepEqual(['C', 'CA', 'CAA'])
    cab.canonicalName.should.deepEqual(['C', 'CA', 'CAB'])
  })

  it('subTasks', function () {
    let subTasks = a.subTasks
    subTasks.length.should.be.exactly(1)
    subTasks[0].name().should.be.exactly('AA')

    subTasks = b.subTasks
    subTasks.length.should.be.exactly(2)
    subTasks[0].name().should.be.exactly('BA')
    subTasks[1].name().should.be.exactly('BB')
  })

  it('find', function () {
    should(a.find('X')).not.be.ok()
    let task = a.find('AA', task => task.description('foo'))
    task.name().should.be.exactly('AA')
    task.description().should.be.exactly('foo')

    should(b.find(['BB', 'X'])).not.be.ok()
    c.find('CA').name().should.be.exactly('CA')

    task = c.find(['CA', 'CAA'], task => task
      .description('bar'))
    task.name().should.be.exactly('CAA')
    task.description().should.be.exactly('bar')
  })

  it('removeSubTask', function () {
    a.removeSubTask('AA')
    a.isLeaf.should.be.exactly(true)
    ;(function () {
      a.removeSubTask('AA')
    }).should.throw(Error)
  })

  it('moveSubTask', function () {
    b.moveSubTask('BB', 'BA')
    b.subTasks[0].name().should.be.exactly('BB')
    b.subTasks[1].name().should.be.exactly('BA')
    b.moveSubTask('BB')
    b.subTasks[0].name().should.be.exactly('BA')
    b.subTasks[1].name().should.be.exactly('BB')
  })

  it('startAt', function () {
    ;(function () {
      a.startAt('2018-10-01')
    }).should.throw(Error)
    should(a.startAt()).not.ok()
    aa.startAt('2018-10-01')
    dateformat(new Date(a.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')

    ba.startAt('2018-10-03')
    bb.startAt('2018-10-01')
    dateformat(new Date(b.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')

    caa.finishAt('2018-10-10')
    dateformat(new Date(c.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
  })

  it('finishAt', function () {
    ;(function () {
      a.finishAt('2018-10-01')
    }).should.throw(Error)
    should(a.finishAt()).not.ok()
    aa.finishAt('2018-10-01')
    dateformat(new Date(a.finishAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')

    ba.finishAt('2018-10-03')
    bb.finishAt('2018-10-01')
    dateformat(new Date(b.finishAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-03')
  })

  it('dependsUpon1', function () {
    ;(function () {
      bb.dependsUpon('X')
    }).should.throw(/no such task/)

    ;(function () {
      bb.dependsUpon(['B', 'BB'])
    }).should.throw(/can not depends upon self/)

    ;(function () {
      bb.dependsUpon(['B'])
    }).should.throw(/can not depends upon ancestor/)

    ;(function () {
      bb.dependsUpon(ba)
      ba.dependsUpon(bb)
    }).should.throw(/cylic/)
  })

  it('dependsUpon2', function () {
    ca.dependsUpon(ba.expectedTimeSpan('2d'))
    ca.expectedToStartAt.should.be.exactly(ts('2d', 'ms'))
    ca.dependsUpon().map(it => it.canonicalName).should.be.deepEqual([['B', 'BA']])

    ca.dependsUpon(aa.expectedTimeSpan('3d'))
    ca.expectedToStartAt.should.be.exactly(ts('3d', 'ms'))
    ca.dependsUpon().map(it => it.canonicalName).should.be.deepEqual([['A', 'AA'], ['B', 'BA']])

    c.dependsUpon(bb.expectedTimeSpan('4d'))
    ca.expectedToStartAt.should.be.exactly(ts('4d', 'ms'))
    ca.dependsUpon().map(it => it.canonicalName).should.be.deepEqual([['A', 'AA'], ['B', 'BA'], ['B', 'BB']])

    bb.dependsUpon(aa)
    ca.expectedToStartAt.should.be.exactly(ts('7d', 'ms'))
    ca.dependsUpon().map(it => it.canonicalName).should.be.deepEqual([['A', 'AA'], ['B', 'BA'], ['B', 'BB']])

    ca.dependsUpon(b)
    ca.expectedToStartAt.should.be.exactly(ts('7d', 'ms'))
    ca.dependsUpon().map(it => it.canonicalName).should.be.deepEqual([['A', 'AA'], ['B']])
  })

  it('dependsUpon previous', function () {
    bb.dependsUpon('~')
    bb.dependsUpon().map(it => it.canonicalName).should.be.deepEqual([['B', 'BA']])
    ;(function () {
      caa.dependsUpon('~')
    }).should.throw(/no previous sibling/)
  })

  it('expectedToStartAt', function () {
    bb.dependsUpon(aa)
      .expectedTimeSpan('2d')
    aa.expectedTimeSpan('1d')
    ba.dependsUpon(bb)
    b.expectedToStartAt.should.be.exactly(ts('1d', 'ms'))
  })

  it('expectedToStartAt2', function () {
    ba.dependsUpon(aa)
    b.expectedToStartAt.should.be.exactly(0)
  })

  it('removeDependsOn', function () {
    ca.dependsUpon(ba)
    ca.removeDependsUpon(ba)
    ca.getDependsUpon().should.have.length(0)
  })

  it('expectedToFinishAt', function () {
    aa.expectedTimeSpan('1d')
    a.expectedToFinishAt.should.be.exactly(ts('1d', 'ms'))
    aa.startAt('2018-10-01')
    dateformat(new Date(a.expectedToFinishAt), 'yyyy-mm-dd').should.be.exactly('2018-10-02')
    aa.finishAt('2018-10-03')
    dateformat(new Date(a.expectedToFinishAt), 'yyyy-mm-dd').should.be.exactly('2018-10-03')
  })

  it('expectedToFinishAt', function () {
    aa.expectedToFinishAt.should.be.exactly(0)
  })

  it('ops', async function () {
    a.ops.should.be.deepEqual([])
    aa.ops.should.be.deepEqual([Task.OP_START, Task.OP_FINISH])
    bb.dependsUpon(aa)
    bb.ops.should.be.deepEqual([])
    aa.finishAt('2018-09-20')
    bb.ops.should.be.deepEqual([Task.OP_START, Task.OP_FINISH])
    bb.opsFilter(ops => ops.slice(1)).ops.should.be.deepEqual([Task.OP_FINISH])

    ca.dependsUpon(bb)
    ca.ops.should.be.deepEqual([])
  })

  it('toJSON/fromJSON', function () {
    aa.finishAt('2018-10-01')
    bb.dependsUpon(['A', 'AA'])
    caa.startArg({ a: 'foo' })
    let _project = new Project().fromJSON(project.toJSON())
    let _aa = _project.$(['A', 'AA'])
    _aa.name().should.be.exactly('AA')
    dateformat(new Date(_aa.finishAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')
    let _caa = _project.$(['C', 'CA', 'CAA'])
    _caa.name().should.be.exactly('CAA')
    _caa.startArg().a.should.be.exactly('foo')
  })

  it('baseline', function () {
    project.base('2018-10-10')
    aa.startAt('2018-10-12')
    dateformat(new Date(aa.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-12')
    let { baseline } = project
    dateformat(new Date(baseline.base()), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
    let _aa = baseline.$(['A', 'AA'])
    should(_aa.startAt()).not.be.ok()
    dateformat(new Date(_aa.expectedToStartAt), 'yyyy-mm-dd').should.be.exactly('2018-10-10')
  })
})
