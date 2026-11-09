import { ActivationFields } from './ActivationFields';

export const ActivationLabels = Object.freeze({
  [ActivationFields.request]: '# Requests',
  [ActivationFields.unique_click]: '# Unique Clicks',
  [ActivationFields.unique_open]: '# Unique Opens',
  [ActivationFields.unique_proxy_loaded]: '# Unique Proxy Loaded',
  [ActivationFields.unsub]: '# Unsubscribes',
  [ActivationFields.complaint]: '# Complaints',
  [ActivationFields.hard_bounce]: '# Hard Bounces',
  [ActivationFields.soft_bounce]: '# Soft Bounces',

  [ActivationFields.unique_open_rate]: '% Open Rate',
  [ActivationFields.unique_click_rate]: '% Click Rate',
  [ActivationFields.unsub_rate]: '% Unsub Rate',
  [ActivationFields.complaint_rate]: '% Complaint Rate',

  [ActivationFields.request0Attempt]: '# Requests (1st attempt) ',
  [ActivationFields.request1Attempt]: '# Requests (2nd attempt)',
  [ActivationFields.request2Attempt]: '# Requests (3rd attempt)',
  [ActivationFields.request3Attempt]: '# Requests (4th attempt)',
  [ActivationFields.request4AndMoreAttempt]: '# Requests (>4th attempt)'
});
