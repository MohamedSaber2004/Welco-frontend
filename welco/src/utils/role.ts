import { watch } from 'vue'
import { authService } from '../di/container'

export const applyRoleTheme = () => {
  const update = () => {
    const role = authService.isAdmin.value ? 'admin' : authService.isOrganizationUser.value ? 'organization' : authService.isWelcoStaff.value ? 'staff' : 'guest'
    document.documentElement.dataset.role = role
  }
  update()
  watch(() => authService.user.value, update)
}
