/**
 * Centralized enum labels (TSK-018).
 *
 * Colors / icons stay next to the UI that uses them.
 * Text resolution goes through i18n so every screen shares the same keys:
 *   enums.task.status.* | enums.task.priority.* | enums.task.type.*
 *   enums.project.status.* | enums.user.role.* | enums.milestone.status.*
 */
import i18n from './index'

function label(key, fallback) {
  return i18n.t(key, { defaultValue: fallback ?? key })
}

export function taskStatusLabel(status) {
  return label(`enums.task.status.${status}`, status)
}

export function taskPriorityLabel(priority) {
  return label(`enums.task.priority.${priority}`, priority)
}

export function taskTypeLabel(type) {
  return label(`enums.task.type.${type}`, type)
}

export function projectStatusLabel(status) {
  return label(`enums.project.status.${status}`, status)
}

export function userRoleLabel(role) {
  return label(`enums.user.role.${role}`, role)
}

export function milestoneStatusLabel(status) {
  return label(`enums.milestone.status.${status}`, status)
}
