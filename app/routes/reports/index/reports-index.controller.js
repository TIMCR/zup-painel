'use strict';

angular
  .module('ReportsIndexControllerModule', [
    'ReportsDestroyModalControllerModule',
    'OnFocusComponentModule',
    'OnBlurComponentModule',
    'AdvancedFiltersServiceModule',
    'ReportsItemsServiceModule',
    'ConfigServiceModule',
    'ngSanitize',
    'ngCsv'
  ])

  .controller('ReportsIndexController', function ($rootScope, $scope, Restangular, $modal, $q, AdvancedFilters, $location, $window, $cookies, ReportsItemsService, $state, $log, $translate, ConfigService) {

    $log.debug('ReportsIndexController created.');

    $scope.loading = true;
    $rootScope.uiHasScroll = true;

    $scope.loadingPagination = false;
    $scope.filtersHash = null;
    $scope.categories = {};
    $scope.categoriesStatuses = {};

    // Basic filters
    var resetFilters = function () {
      $scope.selectedCategories = [];
      $scope.selectedStatuses = [];
      $scope.selectedUsers = [];
      $scope.selectedReporters = [];
      $scope.selectedGroups = [];
      $scope.beginDate = null;
      $scope.endDate = null;
      $scope.searchText = null;
      $scope.assignedToMyGroup = null;
      $scope.assignedToMe = null;

      // map options
      $scope.position = null;
      $scope.selectedAreas = [];
    };

    resetFilters();

    // Advanced filters
    $translate(['REPORTS_FILTERS_WITH_CATEGORIES', 'REPORTS_FILTERS_WITH_STATUSES', 'REPORTS_FILTERS_REPORT_USER', 'REPORTS_FILTERS_ONLY_DELAYED_REPORTS']).then(function (translations) {
      $scope.availableFilters = [
        {name: 'Protocolo ou endereço contém...', action: 'query'},
        {name: translations.REPORTS_FILTERS_WITH_CATEGORIES, action: 'category'},
        {name: translations.REPORTS_FILTERS_WITH_STATUSES, action: 'status'},
        {name: 'Criado pelos solicitantes...', action: 'author'},
        {name: translations.REPORTS_FILTERS_REPORT_USER, action: 'reporter'},
        {name: 'Por período...', action: 'date'},
        {name: 'Por perímetros...', action: 'area'},
        {name: 'Associados ao meu grupo...', action: 'assignedToMyGroup'},
        {name: 'Associados à mim...', action: 'assignedToMe'}
      ];
    });

    $scope.activeAdvancedFilters = [];

    if (angular.isDefined($cookies.reportsFiltersHash)) {
      $scope.activeAdvancedFilters = JSON.parse($window.atob($cookies.reportsFiltersHash));
    }

    if (angular.isDefined($location.search().filters)) {
      $scope.filtersHash = $location.search().filters;
      $scope.activeAdvancedFilters = JSON.parse($window.atob($scope.filtersHash));
    }

    var pushUnique = function (arr, val) {
      if (arr.indexOf(val) === -1) {
        arr.push(val)
      }
    };

    // Entrypoint / Fires initial load
    $scope.$watch('activeAdvancedFilters', function () {
      resetFilters();

      // save filters into hash
      if ($scope.activeAdvancedFilters.length !== 0) {
        $scope.filtersHash = $window.btoa(JSON.stringify($scope.activeAdvancedFilters));

        $location.search('filters', $scope.filtersHash);

        $cookies.reportsFiltersHash = $scope.filtersHash;
      } else {
        $scope.filtersHash = null;

        $location.search('filters', null);

        delete $cookies.reportsFiltersHash;
      }

      for (var i = $scope.activeAdvancedFilters.length - 1; i >= 0; i--) {
        var filter = $scope.activeAdvancedFilters[i];

        if (filter.type === 'query') {
          $scope.searchText = filter.value;
        }

        if (filter.type === 'categories') {
          pushUnique($scope.selectedCategories, filter.value);
        }

        if (filter.type === 'statuses') {
          pushUnique($scope.selectedStatuses, filter.value);
        }

        if (filter.type === 'groups') {
          pushUnique($scope.selectedGroups, filter.value);
        }

        if (filter.type === 'authors') {
          pushUnique($scope.selectedUsers, filter.value);
        }

        if (filter.type === 'reporters') {
          pushUnique($scope.selectedReporters, filter.value);
        }

        if (filter.type === 'beginDate') {
          $scope.beginDate = filter.value;
        }

        if (filter.type === 'endDate') {
          $scope.endDate = filter.value;
        }

        if (filter.type === 'area') {
          pushUnique($scope.selectedAreas, filter.value);
        }

        if (filter.type === 'assignedToMyGroup') {
          $scope.assignedToMyGroup = true;
        }

        if (filter.type === 'assignedToMe') {
          $scope.assignedToMe = true;
        }
      }

      loadFilters();
    }, true);

    // Return right promise
    $scope.generateReportsFetchingOptions = function () {
      var options = {};

      // if we searching, hit search/users
      if ($scope.searchText !== null) {
        options.query = $scope.searchText;
      }

      // check if we have categories selected
      if ($scope.selectedCategories.length !== 0) {
        options.reports_categories_ids = $scope.selectedCategories.join(); // jshint ignore:line
      }

      // check if we have statuses selected
      if ($scope.selectedStatuses.length !== 0) {
        options.statuses_ids = $scope.selectedStatuses.join(); // jshint ignore:line
      }

      // check if we have groups selected
      if ($scope.selectedGroups.length !== 0) {
        options.groups_ids = $scope.selectedGroups.join(); // jshint ignore:line
      }

      // check if we have users selected
      if ($scope.selectedUsers.length !== 0) {
        options.users_ids = $scope.selectedUsers.join(); // jshint ignore:line
      }

      // check if we have reporters
      if ($scope.selectedReporters.length !== 0) {
        options.reporters_ids = $scope.selectedReporters.join(); // jshint ignore:line
      }

      if ($scope.beginDate !== null) {
        options.begin_date = $scope.beginDate; // jshint ignore:line
      }

      if ($scope.endDate !== null) {
        options.end_date = $scope.endDate; // jshint ignore:line
      }

      // map options
      if ($scope.selectedAreas.length === 0 && $scope.position !== null) {
        options['position[latitude]'] = $scope.position.latitude;
        options['position[longitude]'] = $scope.position.longitude;
        options['position[distance]'] = $scope.position.distance;
      } else if ($scope.selectedAreas.length !== 0) {
        for (var i = $scope.selectedAreas.length - 1; i >= 0; i--) {
          var latKey = 'position[' + i + '][latitude]';
          var lngKey = 'position[' + i + '][longitude]';
          var disKey = 'position[' + i + '][distance]';

          options[latKey] = $scope.selectedAreas[i].latitude;
          options[lngKey] = $scope.selectedAreas[i].longitude;
          options[disKey] = $scope.selectedAreas[i].distance;
        }
      }

      if ($scope.assignedToMyGroup !== null) {
        options.assigned_to_my_group = $scope.assignedToMyGroup;
      }

      if ($scope.assignedToMe !== null) {
        options.assigned_to_me = $scope.assignedToMe;
      }

      return options;
    };

    var loadFilters = $scope.reload = function (reloading) {
      $scope.$broadcast('loadFilters', reloading);
    };

    $scope.removeFilter = function (filter) {
      $scope.activeAdvancedFilters.splice($scope.activeAdvancedFilters.indexOf(filter), 1);
    };

    $scope.resetFilters = function () {
      $scope.activeAdvancedFilters = [];
      $scope.$broadcast('resetFilters');
    };

    $scope.loadFilter = function (status) {
      if (status === 'query') {
        AdvancedFilters.query($scope.activeAdvancedFilters);
      }

      if (status === 'category') {
        AdvancedFilters.category($scope.activeAdvancedFilters, 'reports');
      }

      if (status === 'status') {
        AdvancedFilters.status($scope.activeAdvancedFilters, 'reports');
      }

      if (status === 'group') {
        AdvancedFilters.group($scope.activeAdvancedFilters, 'reports');
      }

      if (status === 'author') {
        AdvancedFilters.author($scope.activeAdvancedFilters);
      }

      if (status === 'reporter') {
        AdvancedFilters.reporter($scope.activeAdvancedFilters);
      }

      if (status === 'date') {
        AdvancedFilters.period($scope.activeAdvancedFilters);
      }

      if (status === 'area') {
        AdvancedFilters.area($scope.activeAdvancedFilters);
      }

      if (status === 'assignedToMyGroup') {
        $translate('REPORTS_FILTERS_REPORTS_ASSOCIATED').then(function(translation){
          $scope.activeAdvancedFilters.push({
            title: translation,
            type: 'assignedToMyGroup',
            desc: 'Ao meu grupo'
          });
        });
      }

      if (status === 'assignedToMe') {
        $translate('REPORTS_FILTERS_REPORTS_ASSOCIATED').then(function(translation){
          $scope.activeAdvancedFilters.push({
            title: translation,
            type: 'assignedToMe',
            desc: 'À mim'
          });
        });
      }
    };

    $scope.openReport = function (report_id, event) {
      if (!$rootScope.loading
        && event.target.parentNode.tagName.toLowerCase() != 'a'
        && event.target.tagName.toLowerCase() != 'a'
      ) {
        $state.go('reports.show', {id: report_id});
      }
    };

    // Search function
    $scope.search = function (text) {
      $scope.searchText = text;
      loadFilters();
    };

    $scope.share = function () {
      AdvancedFilters.share();
    };

    var $handleDestroy = $scope.$on('$destroy', function () {
      $log.debug('ReportsIndexController destroyed.');
    });

    var getData = $scope.getData = function () {
      ConfigService.getReportsColumns().then(function (reportsColumns) {
        $scope.activeColumns = _.filter(reportsColumns, function (c) {
          return c.active;
        });

        $scope.activeColumnsLabel = $scope.activeColumns.map(function(column) { return column.label });
        $scope.activeColumnsLabel.unshift('Status');
      });

      var options = $scope.generateReportsFetchingOptions();

      ReportsItemsService.fetchCSV(options).then(function(reports) {
        $scope.getReports = $.map(reports, function(report) {
          var data = { "Status" : report.status.title };

          $.each($scope.activeColumns, function(i, column) {
            switch(column.type) {
              case 'protocol':
                data[column.label] = report.protocol;
                break;
              case 'priority':
                data[column.label] = report.category.priority_pretty || 'N/A';
                break;
              case 'address':
                data[column.label] = report.address;
                break;
              case 'user':
                data[column.label] = report.user.name;
                break;
              case 'reporter':
                data[column.label] = report.reporter.name;
                break;
              case 'category':
                data[column.label] = report.category.title;
                break;
              case 'assignment':
                if(report.assigned_group && report.assigned_user) {
                  data[column.label] = report.assigned_user.name.split(' ')[0] + ' (' + report.assigned_group.name + ' )';
                } else if(report.assigned_group && !report.assigned_user) {
                  data[column.label] = report.assigned_group.name;
                } else if(!report.assigned_group && report.assigned_user) {
                  data[column.label] = report.assigned_user.name
                } else {
                  data[column.label] = 'Não atribuído';
                }

                break;
              case 'created_at':
                data[column.label] = moment(report.created_at).format('DD/MM/YY HH:mm');
                break;
              case 'custom_field':
                data[column.label] = report.custom_fields[column.id] || 'Não informado';
                break;
            }
          });

          return data;
        });
      });
    };

    $scope.exportData = function() {
      alasql('SELECT * INTO XLSX("report.xlsx",{headers:true}) FROM ?',[$scope.getReports]);
    };

    getData();

    $scope.$on('loadFilters', function (event, reloading) {
      getData();
    });
  });
