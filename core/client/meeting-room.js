const meetingRoom = {
  enabled: false,

  setMeetingRoomService(service) {
    this.service = service;
  },

  getMeetingRoomService() {
    return this.service;
  },

  isOpen() {
    return this.service?.isOpen();
  },

  isEnabled() {
    return this.enabled;
  },
};

export default meetingRoom;
