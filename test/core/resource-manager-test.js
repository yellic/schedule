var schedule = require('../../index'),
    later = require('later'),
    should = require('should'),
    util = require('util');

describe('Resource Manager', function() {

  // resource setup
  var resources = [
        {id: 'A', schedule: {schedules: [{h_a: [8], h_b: [16]}]}},
        {id: 'B', schedule: {schedules: [{h_a: [10], h_b: [14]}]}},
        {id: 'C', schedule: {schedules: [{h_a: [8], h_b: [12]}]}},
        {id: 'D', schedule: {schedules: [{h_a: [18], h_b: [20]}]}},
        {id: 'E', schedule: {schedules: [{h_a: [12], h_b: [14]}]}}
      ],
      startDate = new Date(2013, 2, 21);

  // project schedule setup
  var projSched = later.schedule({schedules: [{h_a: [6], h_b: [20]}]}),
      projNext = schedule.memoizedRangeFn(projSched.nextRange);

  // set to use local time
  schedule.date.localTime();


  describe('resource map', function() {
    var mgr = schedule.resourceManager(resources, startDate);

    it('should contain all of the resources', function() {
      var map = mgr.resourceMap();

      should.exist(map.A);
      should.exist(map.B);
      should.exist(map.C);
      should.exist(map.D);
      should.exist(map.E);
    });

    it('should specify the next time that the resource is available', function() {
      var map = mgr.resourceMap();

      map.A.nextAvail.should.eql([
        (new Date(2013, 2, 21, 8, 0, 0)).getTime(),
        (new Date(2013, 2, 21, 16, 0, 0)).getTime()
      ]);
      map.B.nextAvail.should.eql([
        (new Date(2013, 2, 21, 10, 0, 0)).getTime(),
        (new Date(2013, 2, 21, 14, 0, 0)).getTime()
      ]);
      map.C.nextAvail.should.eql([
        (new Date(2013, 2, 21, 8, 0, 0)).getTime(),
        (new Date(2013, 2, 21, 12, 0, 0)).getTime()
      ]);
      map.D.nextAvail.should.eql([
        (new Date(2013, 2, 21, 18, 0, 0)).getTime(),
        (new Date(2013, 2, 21, 20, 0, 0)).getTime()
      ]);
      map.E.nextAvail.should.eql([
        (new Date(2013, 2, 21, 12, 0, 0)).getTime(),
        (new Date(2013, 2, 21, 14, 0, 0)).getTime()
      ]);
    });


  });

  describe('make reservation', function() {

    it('should include requested resource', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation(['A'], projNext, startDate);

      res.resources.should.eql(['A']);
      res.success.should.eql(true);
    });

    it('should include requested resource when multiple', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation(['A', 'B'], projNext, startDate);

      res.resources.should.eql(['A', 'B']);
      res.success.should.eql(true);
    });

    it('should include only reserved resources with OR', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation([['A', 'B']], projNext, startDate);

      res.resources.should.eql(['A']);
      res.success.should.eql(true);
    });

    it('should reserve resource at earliest available time', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation(['A'], projNext, startDate);

      res.start.should.eql((new Date(2013, 2, 21, 8, 0, 0)).getTime());
      res.success.should.eql(true);
    });

    it('should reserve multiple resource at earliest available overlap', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation(['A', 'B'], projNext, startDate);

      res.start.should.eql((new Date(2013, 2, 21, 10, 0, 0)).getTime());
      res.success.should.eql(true);
    });

    it('should reserve earliest available resource on OR', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation([['A', 'B']], projNext, startDate);

      res.start.should.eql((new Date(2013, 2, 21, 8, 0, 0)).getTime());
      res.success.should.eql(true);
    });

    it('should reserve earliest available resource on multiple AND', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation(['A', 'B', 'E'], projNext, startDate);

      res.start.should.eql((new Date(2013, 2, 21, 12, 0, 0)).getTime());
      res.success.should.eql(true);
    });

    it('should reserve for minimum duration specified', function() {
      var d = new Date(2013, 2, 21, 12, 0, 0),
          mgr = schedule.resourceManager(resources, d),
          res = mgr.makeReservation(['B'], projNext, d, 240);

      res.start.should.eql((new Date(2013, 2, 22, 10, 0, 0)).getTime());
      res.duration.should.eql(240);
      res.success.should.eql(true);
    });

    it('should reserve for minimum duration specified using OR', function() {
      var d = new Date(2013, 2, 21, 16, 0, 0),
          mgr = schedule.resourceManager(resources, d),
          res = mgr.makeReservation([['B', 'D']], projNext, d, 240);

      res.start.should.eql((new Date(2013, 2, 22, 10, 0, 0)).getTime());
      res.duration.should.eql(240);
      res.success.should.eql(true);
    });

    it('should reserve for maximum duration specified', function() {
      var d = new Date(2013, 2, 21, 12, 0, 0),
          mgr = schedule.resourceManager(resources, d),
          res = mgr.makeReservation(['B'], projNext, d, 1, 30);

      res.start.should.eql((new Date(2013, 2, 21, 12, 0, 0)).getTime());
      res.duration.should.eql(30);
      res.success.should.eql(true);
    });

    it('success should be false if reservation could not be made', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          res = mgr.makeReservation(['B', 'D'], projNext, startDate);

      res.success.should.eql(false);
    });

    it('should maintain consecutive reservations', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          resA = mgr.makeReservation(['A'], projNext, startDate, 1, 240),
          resB = mgr.makeReservation(['A'], projNext, startDate, 1, 240);

      resA.start.should.eql((new Date(2013, 2, 21, 8, 0, 0)).getTime());
      resA.duration.should.eql(240);
      resA.success.should.eql(true);

      resB.start.should.eql((new Date(2013, 2, 21, 12, 0, 0)).getTime());
      resB.duration.should.eql(240);
      resB.success.should.eql(true);
    });

    it('should maintain non-consecutive reservations', function() {
      var mgr = schedule.resourceManager(resources, startDate),
          resA = mgr.makeReservation(['A', 'B'], projNext, startDate, 1, 240),
          resB = mgr.makeReservation(['A'], projNext, startDate, 1, 120);

      resA.start.should.eql((new Date(2013, 2, 21, 10, 0, 0)).getTime());
      resA.duration.should.eql(240);
      resA.success.should.eql(true);

      resB.start.should.eql((new Date(2013, 2, 21, 8, 0, 0)).getTime());
      resB.duration.should.eql(120);
      resB.success.should.eql(true);
    });

  });

  describe('move start date', function() {
    var mgr = schedule.resourceManager(resources, startDate),
        resA = mgr.makeReservation(['A', 'B'], projNext, startDate, 1, 240),
        resB = mgr.makeReservation(['A', 'B'], projNext, startDate, 1, 120),
        resC = mgr.makeReservation(['A', 'B'], projNext, startDate, 1, 240),
        resD = mgr.makeReservation(['A', 'B'], projNext, startDate, 1, 120);

    it('should remove exceptions occurring before date', function() {
      var map = mgr.resourceMap();
      map.A.schedule.exceptions.length.should.eql(4);

      mgr.moveStartDate(new Date(2013,2, 22));
      map.A.schedule.exceptions.length.should.eql(3);

      mgr.moveStartDate(new Date(2013,2, 23));
      map.A.schedule.exceptions.length.should.eql(1);

      mgr.moveStartDate(new Date(2013,2, 24));
      map.A.schedule.exceptions.length.should.eql(0);
    });

  });




});