import Project from './project'

export function project (name) {
  return new Project(name)
}

export { default as Project } from './Project'
export { default as Task } from './task'
