export function getHistoryTypeLabel(type) {
  switch (type) {
    case 'content_deactivation':
      return 'Content Deactivation';
    case 'content_activation':
      return 'Content Activation';
    case 'content_suspension':
      return 'Content Suspension';
    case 'sendingConfig_updateConfigScore':
      return 'Auto Update Sending Config Score';
    case 'sendingConfig_update':
      return 'Update Sending Config';
    case 'esp_exclusion':
      return 'Esp Exclusion';
    case 'content_suspension_recommendation':
      return 'Content Suspension Recommendation';
    default:
      return '';
  }
}
