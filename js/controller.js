'use strict'

var appCtrl = angular.module('appCtrl', [
    'appServices',
    'ui.bootstrap',
]);

appCtrl.controller('initCtrl', [
  '$scope',
  '$http', 
  '$modal', 
  'Docs', 
  'Globals',
  function($scope, $http, $modal, Docs, Globals) {

    $scope.globals = Globals;
    $scope.docs = Docs;

    $scope.searchForm = {
      labels: [],
      docNumbers: [],
      docName: "",
      opened: true,
      findDocs: function () {
        var that = this;
        var request = this.makeSearchJSON();

        if (!angular.isDefined(request)) {
          return
        }
        
        $scope.docs.find(request)
          .then(function (result) {
            var modal = $modal.open({
              animation: true,
              templateUrl: '/public/angular-tpls/searchResultModal.html',
              controller: 'searchResultModalCtrl',
              size: 'lg',
              resolve: {
                'result': function () { return result },
              },
            });
            modal.result.then(function () {
              that.toggle();
            });
          })
          .catch(function (response) {
            $scope.globals.globalErrMsg(response.Msg);
          });

      },

      toggle: function () {
        this.opened = !this.opened;
      },

      clear: function () {
        this.labels = [];
        this.docNumbers = [];
        this.docName = "";
      },

      keyEvents: function (keyEvent) {
        if (keyEvent.which === 13) {
          this.findDocs();
        }
      },

      makeSearchJSON: function () {
        var searchObj = {};
        var valid = 0;
        
        if (this.labels.length > 0) {
          searchObj['labels'] = {'$in': this.labels};
          valid += 1;
        }
        if (this.docNumbers.length > 0) {
          var tmp = [];
          angular.forEach(this.docNumbers, function (v, k) {
            tmp.push(v.toString());
          });
          searchObj['accountdata.docnumbers'] = {'$in': tmp};
          valid += 1;
        }
        if (this.docName !== "") {
          searchObj['name'] = {'$regex': '/'+ this.docName +'/'};
          valid += 1;
        }

        if (valid === 0) {
          return undefined;
        } else {
          return JSON.stringify(searchObj);
        }
      },

    };

  }
]);

appCtrl.controller('searchResultModalCtrl', ['$scope', '$modalInstance', 'result', 'Docs', 'Globals',
  function ($scope, $modalInstance, result, Docs, Globals) {
    $scope.docs = Docs;
    $scope.globals = Globals;
    $scope.result = result;

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };

    $scope.use = function () {
      $scope.docs.saveDocs($scope.result);
      var doc = $scope.docs.firstDoc();
      $modalInstance.close();
      $scope.globals.goToDoc(doc.name)
    };

    $scope.keyEvents = function (keyEvent) {
      if (keyEvent.which === 13) {
        $scope.use();
      }
    };

  }
]);

appCtrl.controller('loginCtrl', ['$scope', '$rootScope', '$http', '$location', '$log', 'User', 
  function($scope, $rootScope, $http, $location, $log, User) {
    angular.element("#username").focus();
    $scope.login = function () {
      var user = {Username: $scope.username,
                  Password: $scope.password}
      $http.post('/Login', user)
        .success(function (data) {
          if (data.Status === 'fail') {
            $log.error(data.Msg);
          } else if (data.Status === 'success') {
            $rootScope.loggedInAs = user.Username;
            $rootScope.user = user
            $location.url('/newDocs');
          }
        })
        .error(function (data) {
          $log.error(data);
        })
    }

  }
]);

appCtrl.controller('newDocsCtrl', ['$scope', '$location', 'Docs', 'Globals',
  function ($scope, $location, Docs, Globals) {
    $scope.globals = Globals;
    $scope.docs = Docs;
    $scope.docs.find('{"labels": {"$in":  ["Neu"]}}')
      .then(function (result) {
        $scope.docs.saveDocs(result);
        var doc = $scope.docs.firstDoc();
        $scope.globals.goToDoc(doc.name); 
      });

  }
]);

appCtrl.controller('singleViewCtrl', [
  '$scope', '$rootScope', '$http', '$log', '$routeParams', '$location', '$q',
  '$timeout', '$document', '$modal', 'pdfDelegate', 'User',
  'SearchStr', 'Docs', 'Globals', 'AccProcess',
  function ($scope, $rootScope, $http, $log, $routeParams, 
    $location, $q, $timeout, $document, $modal, pdfDelegate, User,
    SearchStr, Docs, Globals, AccProcess) {
  
    var setupCtrl = function () {
      $scope.globals = Globals;

      if (!angular.isDefined($rootScope.user)) {
        $scope.globals.goToLogin()
        return
      }

      $scope.searchStr = SearchStr;
      $scope.accProcess = AccProcess;

      $scope.currPDFPage = 1;
      $scope.totalPDFPages = '?';

      $scope.docName = $routeParams.docName;
      $scope.docs = Docs;
      $scope.doc = $scope.docs.readDoc($scope.docName);

      // Das Datums-Format welches in der Datenbank hinterlegt ist
      // möchte kein Benutzer lesen damit das konvertieren zwischen
      // Benutzeransicht und das speichern des Datums in der Datenbank
      // funtkioniert werden Proxy Felder im doc Objekt anglegt.
      var g = $scope.globals // Hilft gegen zu lange Zeilen
      var from = g.makeEuroDateFormat($scope.doc.accountdata.docperiod.from);
      var to = g.makeEuroDateFormat($scope.doc.accountdata.docperiod.to);
      $scope.doc.accountdata.docperiod.fromProxy = from;
      $scope.doc.accountdata.docperiod.toProxy = to;

      $scope.pdf.setup($scope.docName);
      
    }


    $scope.modals = {
      changeDocName: {
        id: "change-docname",
        input: "",
        modal: undefined,
        save: function () {
          var that = this;
          $scope.docs.changeDocName($scope.doc.name, this.input)
            .then(function (response) {
              $log.debug('renamed '+ that.input);
              that.modal.close()
              $scope.doc.name = that.input;
              $scope.globals.goToDoc(that.input);
            })
            .catch(function (response) {
              $scope.globals.globalErrMsg(response.Msg);
            });
        },
        keyEvent: function (keyEvent) {
          if (keyEvent.which === 13) {
            this.save();
          }
        },
        open: function () {
          var that = this;

          this.modal = $modal.open({
            animation: true,
            templateUrl: '/public/angular-tpls/changeDocNameModal.html', 
            scope: $scope,
          });

          this.modal.opened.then(function () {
            $log.debug($scope.doc.name);
            that.input = $scope.doc.name;
            angular.element('input.changeDocName-start').focus(); 
          });

        },
        cancel: function () {
          this.modal.dismiss('cancel');
        }
      },

      accProcess: {
        modal: undefined,
        open: function () {
          var that = this;
          var docNumbers = $scope.doc.accountdata.docnumbers;
          var accNumber = $scope.doc.accountdata.accnumber;
          var from = $scope.doc.accountdata.docperiod.from;
          var to = $scope.doc.accountdata.docperiod.to;
          $scope.accProcess.findAll(docNumbers, accNumber, from, to)
            .then(function (accProcess) {

              that.modal = $modal.open({
                animation: true,
                templateUrl: '/public/angular-tpls/accProcessModal.html',
                scope: $scope,
                windowClass: 'accProcess-modal'
              });


            })
            .catch(function (response) {
              $scope.globals.globalErrMsg(response.Msg)
            });
        },
        cancel: function () {
          $log.debug('cancel accprocess modal');
          this.modal.dismiss('cancel');
        },

      },

    };

    $scope.labels = {
      input: [],
      save: function () {
        var docName = $scope.doc.name;
        var that = this;
        $scope.docs.appendLabels(docName, this.input)
          .then(function (response) {
            $log.debug("Aw:"+ response);
            that.input = [];
          })
          .catch(function (response) {
            $log.error(response);
            $scope.globals.globalErrMsg(response.Msg);
          });
      },
      keyEvent: function (keyEvent) {
        if (keyEvent.which === 13) {
          this.save()
        }
      },
      remove: function (label) {
        var docName = $scope.doc.name;
        $scope.docs.removeLabel(docName, label)
          .then(function (response) {
            $log.debug(response);
          })
          .catch(function (response) {
            $log.debug(response);
            $scope.globals.globalErrMsg(response);
          });
      }
    };

    $scope.docnumbers = {
      input: [],
      save: function () {
        var docName = $scope.doc.name;
        var that = this;
        $scope.docs.appendDocNumbers(docName, this.input)
          .then(function (response) {
            $log.debug(response);
            that.input = [];
          })
          .catch(function (response) {
            $log.error(response);
            $scope.globals.globalErrMsg(response);
          });
      },
      keyEvent: function (keyEvent) {
        if (keyEvent.which === 13) {
          this.save()
        }
      },
      remove: function (number) {
        $scope.docs.removeDocNumber($scope.doc.name, number)
          .then(function (response) {
            $log.debug(response);
          })
          .catch(function (response) {
            $log.error(response);
            $scope.globals.globalErrMsg(response);
          });
      }
    };
    

    $scope.pdf = {
      url: '',
      totalPages: '?',
      currPage: 1,

      zoomIn: function() {
        this.handler().zoomIn();
      },

      zoomOut: function() {
        this.handler().zoomOut();
      },

      nextPage: function() {
        var pdfDoc = this.handler()
        pdfDoc.next();
        this.currPage = pdfDoc.getCurrentPage();
        this.totalPages = pdfDoc.getPageCount();
      },

      prevPage: function() {
        var pdfDoc = this.handler()
        pdfDoc.prev();
        this.currPage = pdfDoc.getCurrentPage();
        this.totalPages = pdfDoc.getPageCount();
      },

      handler: function () {
        return pdfDelegate.$getByHandle('pdfFile')
      },

      setup: function (docName) {
        var that = this;
        this.url = '/ReadDocFile/'+ docName;
        PDFJS.disableWorker = true;
        this.handler().load(this.url);
        this.currPage = 1;

        var timer = $timeout(function() { 
          that.totalPages = that.handler().getPageCount();
        }, 1000);

        $scope.$on('destroy', function () {
          $timeout.cancel(timer);
        });

      /*
      PDFJS.disableWorker = true;
      $http.get($scope.pdfUrl)
        .success(function (data) {
          for(var x=0;x<11;x++) {
          }
          var pdf = PDFJS.getDocument({data: data}).then(function (pdf) {;
            pdf.getPage(1).then(function(page) {
              var scale = 1;
              var viewport = page.getViewport(scale);

              var canvas = document.getElementById('pdf-files');
              var context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              var renderContext = {
                canvasContext: context,
                viewport: viewport
              };
              page.render(renderContext);

            });
          });
        })
        .error(function (data) {

        });
        */
      }


    }

    $scope.nextDoc = function () {
      var nextDoc = $scope.docs.nextDoc();
      $scope.globals.goToDoc(nextDoc.name);
    }

    $scope.prevDoc = function () {
      var prevDoc = $scope.docs.prevDoc();
      $scope.globals.goToDoc(prevDoc.name);
    }

    $scope.saveAccData = function () {
      var g = $scope.globals
      var docName = $scope.doc.name;
      var accNumber = parseInt($scope.doc.accountdata.accnumber);
      var from = g.makeMongoDBDate($scope.doc.accountdata.docperiod.fromProxy)
      var to = g.makeMongoDBDate($scope.doc.accountdata.docperiod.toProxy)
      var accData = {
        accNumber: accNumber,
        docPeriod: {
          from: from,
          to: to,
        }
      }
      $scope.docs.saveAccData(docName, accData)
        .then(function (response) {
          $log.debug('successfully saved accountd data');
          $scope.doc.accountdata.accnumber = accNumber;
          $scope.doc.accountdata.docperiod.from = from;
          $scope.doc.accountdata.docperiod.to = to;
          $scope.accDataGlowGreen = true;
          $timeout(function () {
            $scope.accDataGlowGreen = false;
          }, 2000);
        })
        .catch(function (response) {
          $log.error(response);
          $scope.globals.globalErrMsg(response);
        });
    }

    $scope.saveNote = function () {
      var docName = $scope.doc.name;
      $scope.docs.saveNote(docName, $scope.doc.note)
        .then(function (response) {
          $log.debug('Save succesfully');
          $scope.noteGlowGreen = true;
          $timeout(function () {
            $scope.noteGlowGreen = false;
          }, 2000);
        })
        .catch(function (response) {
          $log.error(response);
          $scope.globals.globalErrMsg(response);
        });
    }

    // Run on start
    setupCtrl();

  }
]);
