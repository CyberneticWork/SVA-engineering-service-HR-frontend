import axios from "@utils/axios";

export const getPortalHome = (params = {}) =>
  axios.get('/me/portal', { params }).then((r) => r.data);

export const getMyAttendance = (params = {}) =>
  axios.get('/me/attendance', { params }).then((r) => r.data);

export const getMyOvertime = (params = {}) =>
  axios.get('/me/overtime', { params }).then((r) => r.data);

export const getMyNopay = (params = {}) =>
  axios.get('/me/nopay', { params }).then((r) => r.data);

export const getMySalary = () =>
  axios.get('/me/salary').then((r) => r.data);

export const getMyLeaves = () =>
  axios.get('/me/leaves').then((r) => r.data);

export const submitLeave = (payload, file) => {
  if (file) {
    const fd = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        fd.append(key, value);
      }
    });
    fd.append("evidence", file);
    return axios.post("/me/leaves", fd).then((r) => r.data);
  }
  return axios.post("/me/leaves", payload).then((r) => r.data);
};

export const attachLeaveEvidence = (id, file) => {
  const fd = new FormData();
  fd.append("evidence", file);
  return axios.post(`/me/leaves/${id}/evidence`, fd).then((r) => r.data);
};

export const getCoveringColleagues = (params = {}) =>
  axios.get('/me/covering-colleagues', { params }).then((r) => r.data);

export const getCoveringLeaves = () =>
  axios.get('/me/covering-leaves').then((r) => r.data);

export const respondCoveringLeave = (id, payload) =>
  axios.put(`/me/covering-leaves/${id}`, payload).then((r) => r.data);

export const getMyAdvances = () =>
  axios.get('/me/advances').then((r) => r.data);

export const submitAdvance = (payload) =>
  axios.post('/me/advances', payload).then((r) => r.data);

export const changeMyPassword = (payload) =>
  axios.post('/me/change-password', payload).then((r) => r.data);

export const getMyPunch = () =>
  axios.get('/me/punch').then((r) => r.data);

export const punchFromPhone = (payload) =>
  axios.post('/me/punch', payload).then((r) => r.data);

export const getMyNotices = () =>
  axios.get('/me/notices').then((r) => r.data);

export const savePushToken = (payload) =>
  axios.post('/me/push-token', payload).then((r) => r.data);

export const getMyResignations = () =>
  axios.get('/me/resignations').then((r) => r.data);

export const submitResignation = (payload, files = []) => {
  const fd = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      fd.append(key, value);
    }
  });
  (files || []).forEach((file, index) => {
    fd.append(`documents[${index}]`, file);
  });
  return axios.post('/me/resignations', fd).then((r) => r.data);
};

export const listAdvanceRequests = (params = {}) =>
  axios.get('/hr/advance-requests', { params }).then((r) => r.data);

export const reviewAdvanceRequest = (id, payload) =>
  axios.post(`/hr/advance-requests/${id}/review`, payload).then((r) => r.data);

export const createHrAdvance = (payload) =>
  axios.post('/hr/advance-requests', payload).then((r) => r.data);

export const updateAdvanceDeductFrom = (id, deduct_from) =>
  axios.post(`/hr/advance-requests/${id}/deduct-from`, { deduct_from }).then((r) => r.data);
