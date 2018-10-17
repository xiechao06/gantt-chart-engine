import Project from './project'

export function project (name) {
  return new Project(name)
}

export { default as Project } from './project'
export { default as Task } from './task'
