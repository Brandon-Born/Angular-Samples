/* *****************************************************
	 *	PORTAL CONTROLLER
	 **************************************************** */
	.controller('Portal', [
		'$scope', '$api', '$location', 'userService', 'stateService', 
		function($scope, $api, $location, userService, stateService) {
			
        $scope.user;
		$scope.courses;
		$scope.availableUsers =		0;
		$scope.editing =			false;
		$scope.requests = {
			inviteEmail :			''
		};
		$scope.password = {
			status :	 			'',
			currentPassword :		'',
			newPassword :			'',
			passwordConfirmation :	''
		};
        $scope.referral = {
            email :                 '',
            message :               '',
            status :                ''
        };
		// get all states and add a "default" option
		$scope.states =				stateService.getStates();
		$scope.states.unshift( {name : "Choose a state", code : ""} );
		$scope.stateLabel =			'';
		$scope.subscriptionMeta = {
			loaded :				false,
			error :					false,
			users :					[],
			invitations :			[]
		};
        $scope.isSubmitting =       false;
        $scope.usernameError =      false;
			
		var userCopy;
			
		// listen for state changes so we can do name lookups
		$scope.$watch('user.state', function(newValue, oldValue){
			var stateObj =		stateService.lookupState(newValue);
			if(stateObj){
				$scope.stateLabel =	stateObj.name;
			}
		});
		
		// load user
		userService.getUserWithUpdates($scope, function(event, user){
			if(user){
				$scope.user =				user;
				loadSubscriptionMeta();	
			}else{
				// login required - go home
				$location.path('/');
			}
		});
			
		// edit user
		$scope.editProfile = function(){
			$scope.editing = true;
			// create a clean copy of the user for rollback
			userCopy =		angular.copy($scope.user);
		};
			
		// cancel user edit
		$scope.cancelEdit =	function(){
			$scope.editing = 	false;
			// revert changes back to clean user copy
			$scope.user =		userCopy;
		};
			
		// persist user edits
		$scope.saveProfile = function(){
            $scope.isSubmitting =   true;
            $scope.usernameError =  false;
            
			var request = $api.post('/user', {
				name : $scope.user.name, 
				email : $scope.user.email, 
				state : $scope.user.state, 
				zip : $scope.user.zip
			});

			request.success( function(data, status, headers, config){
				// all done editing
				$scope.editing = false;
			});

            request.error(function (error, status, headers, config) {
                // check for username error
                if(status === 500 && error.message && error.message.toLowerCase() === 'email address already in use'){
                    $scope.usernameError =  true;
                }
            });

            request['finally'](function () {
                $scope.isSubmitting = false;
            });
		};
			
		// edit password
		$scope.editPassword = function(){
			$scope.password.currentPassword = 		'';
			$scope.password.newPassword =			'';
			$scope.password.passwordConfirmation =	'';
			$scope.password.status =				'editing';
		};
			
		// cancel password edit
		$scope.cancelEditPassword = function(){
			$scope.password.status =	'';
		};

        $scope.submitReferral = function() {
            $scope.referral.status =    'pending';

            var request =	$api.post('user/referral', $scope.referral);

            request.success(function(data, status, headers, config){
                $scope.referral.status =    'success';
                $scope.referral.email =     '';
                $scope.referral.message =   '';
            });

            request.error(function(error, status, headers, config){
                $scope.referral.status =    '';
                noty({text : 'Sorry, there was a problem completing your request.'});
            });

            request['finally'](function () {
                $scope.referral.status =    '';
            });
        };

		$scope.submitPasswordChange = function(){
			if($scope.password.status !== 'editing')	return;
			
			// make sure password and confirmation match
			if($scope.password.newPassword !== $scope.password.passwordConfirmation){
                noty({text : 'Password and confirmation do not match'});
				return;
			}
			
			// make sure the new password matches requirements
			if($scope.password.newPassword.length < 6){
                noty({text : 'Password must be at least 6 characters'});
				return;
			}
            $scope.isSubmitting = true;

			var request =	$api.post('user/password', $scope.password);

			request.success(function(data, status, headers, config){
				$scope.password.success = true;
                $scope.isSubmitting = false;
			});

			request.error(function(error, status, headers, config){
                noty({text : 'Sorry, there was a problem completing your request. Please verify your password.'});
                $scope.isSubmitting = false;
			});

            request['finally'](function () {
                $scope.isSubmitting =    false;
            });
		};
			
		$scope.sendInvite = function(){
            $scope.isSubmitting = true;
			var request = $api.post('invitation/', { subscription : $scope.user.subscription.id, email : $scope.requests.inviteEmail}, true);

			request.success(function(data, status, headers, config){
                $scope.isSubmitting = false;
				// clear input
				$scope.requests.inviteEmail =	'';
				// reload invite list
				loadSubscriptionMeta();
			});

            request['finally'](function () {
                $scope.isSubmitting =    false;
            });
		};

		$scope.cancelInvitation = function(invitation){
			var request = $api._delete('invitation/' + invitation.id, {}, true);

			request.success(function(data, status, headers, config){
				loadSubscriptionMeta();
			});
		};

		$scope.printCertificate = function(userCourseID){
            window.open('/index.cfm/certificates/new?courses=' + userCourseID, '_blank');
		};
			
		var init = function(){
			loadCourses();
		};
			
		var loadCourses = function(){
			// load user courses
			var coursesRequest =	$api.get('/user/courses/');

			coursesRequest.success( function(data, status, headers, config){
				if(data){
					$scope.courses =	data.history;
				}else{
                    $scope.courses = [];
				}
			});

            coursesRequest.error(function(){
                $scope.courses = { error : true, length : 0 };
            });
		};
			
		var loadSubscriptionMeta = function(){
			var request =	$api.get('subscriptions/' + $scope.user.subscription.id + '/users');

			request.success( function(data, status, headers, config){
				if(data){
					$scope.subscriptionMeta.loaded = 		true;
					$scope.subscriptionMeta.users =			data.users;
					$scope.subscriptionMeta.invitations =	data.invitations;
                    
                    // get subscription out of the data, don't use the user in scope because it hasn't been updated yet
                    if(data.users.length > 0){
                        var subscription =                  data.users[0].subscription;
                        $scope.availableUsers = 			subscription.type.userCount - subscription.userCount - $scope.subscriptionMeta.invitations.length;
                    }
				}
			});

			request.error(function(error, status, headers, config){
				$scope.subscriptionMeta.error =			true;
			});
		};
			
		init();

    }])