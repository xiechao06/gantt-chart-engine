const should = require('should')
const { Task, Project } = require('./src/')
const dateformat = require('dateformat')
const ts = require('timestring')
const sinon = require('sinon')
require('should-sinon')

describe('leaf task', function () {
  let task

  beforeEach(function () {
    task = new Task()
  })

  it('is leaf', function () {
    task.isLeaf.should.be.exactly(true)
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
    task.expectedTimeSpan('1d').expectedTimeSpan().should.be.exactly(1 * 24 * 3600 * 1000)
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
    await task.perform(Task.ACTION_START)
    startCb.should.be.calledOn(task)
    await task.perform(Task.ACTION_FINISH)
    finishCb.should.be.calledOn(task)
  })

  it('ops', async function () {
    task.ops().should.have.length(2)
    task.ops()[0].should.be.exactly(Task.ACTION_START)
    task.ops([Task.ACTION_FINISH]).ops().should.have.length(1)
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
          .expectedTimeSpan('1d')
        )
      )
      .addSubTask(task => task
        .name('B')
        .addSubTask(task => task
          .name('BA')
          .expectedTimeSpan('1d')
        )
        .addSubTask(task => task
          .name('BB')
          .expectedTimeSpan('2d')
        )
      )
      .addSubTask(task => task
        .name('C')
        .addSubTask(task => task
          .name('CA')
          .addSubTask(task => task
            .name('CAA')
            .expectedTimeSpan('1d')
          )
          .addSubTask(task => task
            .name('CAB')
            .expectedTimeSpan('2d')
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
    should(a.startAt()).be.exactly(void 0)
    aa.startAt('2018-10-01')
    dateformat(new Date(a.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')

    ba.startAt('2018-10-03')
    ba.startAt('2018-10-01')
    dateformat(new Date(b.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')
  })

  it('finishAt', function () {
    ;(function () {
      a.finishAt('2018-10-01')
    }).should.throw(Error)
    should(a.finishAt()).be.exactly(void 0)
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

  it('expectedToStartAt', function () {
    bb.dependsUpon(aa)
    aa.expectedTimeSpan('1d')
    b.expectedToStartAt.should.be.exactly(ts('1d', 'ms'))
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

  it('ops', async function () {
    ;(function () {
      a.ops([Task.ACTOIN_START])
    }).should.throw(/can't set ops/)
    a.ops().should.be.deepEqual([])
  })

  it('toJSON/fromJSON', function () {
    aa.startAt('2018-10-01')
    caa.startArg({ a: 'foo' })
    let _project = new Project().fromJSON(project.toJSON())
    let _aa = _project.$(['A', 'AA'])
    _aa.name().should.be.exactly('AA')
    dateformat(new Date(aa.startAt()), 'yyyy-mm-dd').should.be.exactly('2018-10-01')
    let _caa = _project.$(['C', 'CA', 'CAA'])
    _caa.name().should.be.exactly('CAA')
    _caa.startArg().a.should.be.exactly('foo')
  })
})
