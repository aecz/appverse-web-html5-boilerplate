'use strict';

/**
 * @ngdoc module
 * @name AppLogging
 * @description
 *
 * The Logging module handles several tasks with logging:
 *
 * 1 - It applies a decorator on native $log service in module ng.
 *
 * 2 - It includes sending of log events to server-side REST service.
 *
 * WARNING
 *
 * IT IS STRONGLY RECOMMENDED TO USE THIS LOG IMPLEMENTATION AND NEVER directly to use console.log() to log debugger messages.
 * If you do not use this one, use $log instead at least...
 *
 * SERVER SIDE LOG
 *
 * To handle JavaScript errors, we needed to intercept the core AngularJS error handling and add a server-side communication aspect to it.
 *
 * DECORATOR WAY
 *
 * The $provide service (which provides all angular services) needs 2 parameters to “decorate” something:
 *
 * 1) the target service;
 *
 * 2) the callback to be executed every time someone asks for the target.
 *
 * This way, we are telling in config time to Angular that every time a service/controller/directive asks for $log instance, Angular will provide the result of the callback. As you can see, we are passing the original $log and formattedLogger (the API implementation) to the callback, and then, he returns a formattedLogger factory instance.
 */
angular.module('AppLogging', ['AppConfiguration', 'AppDetection'])

.config(["$provide",
    function ($provide) {
        $provide.decorator("$log", ['$delegate', 'formattedLogger',
            function ($delegate, formattedLogger) {
                return formattedLogger($delegate);
            }]);
    }])
/**
 * @ngdoc service
 * @name AppLogging.factory:formattedLogger
 * @requires LOGGING_CONFIG
 * @requires Detection
 * @param {Object} delegatedLog desc
 * @description
 * Captures the $log service and decorate it.
 */
.factory("formattedLogger", ["LOGGING_CONFIG", "Detection",
    function (LOGGING_CONFIG, Detection) {
        return function (delegatedLog) {

            /**
             * @function DateTime
             * @param date The date to be formatted
             * @param format The format of the returned date
             *
             * @description
             * It formats a date
             */
            function dateTime(date, format) {

                date = date || new Date();
                format = format || LOGGING_CONFIG.LogDateTimeFormat;

                function pad(value) {
                    return (value.toString().length < 2) ? '0' + value : value;
                }

                return format.replace(/%([a-zA-Z])/g, function (_, fmtCode) {
                    switch (fmtCode) {
                    case 'Y':
                        return date.getFullYear();
                    case 'M':
                        return pad(date.getMonth() + 1);
                    case 'd':
                        return pad(date.getDate());
                    case 'h':
                        return pad(date.getHours());
                    case 'm':
                        return pad(date.getMinutes());
                    case 's':
                        return pad(date.getSeconds());
                    case 'z':
                        return pad(date.getMilliseconds());
                    default:
                        throw new Error('Unsupported format code: ' + fmtCode);
                    }
                });
            }

            /**
             * @function handleLogMessage
             * @param enable Is enabled in configuration
             * @param logLevel Configures maximumm log level
             * @param logFunction Explicit method from delegatedLog
             *
             * @description
             * It arranges the log message and send it to the server registry.
             */
            function handleLogMessage(enable, logLevel, logFunction) {
                try {

                    if (!enable) {
                        return function () {};
                    }

                    var logMessage = logLevel + " | " + LOGGING_CONFIG.CustomLogPreffix + " | ";

                    return function () {
                        var args = Array.prototype.slice.call(arguments);
                        if (Object.prototype.toString.call(args[0]) === '[object String]') {
                            args[0] = logMessage + dateTime() + " | " + args[0];
                        } else {
                            args.push(args[0]);
                            args[0] = logMessage + dateTime() + " | ";
                        }
                        logFunction.apply(null, args);

                        if (LOGGING_CONFIG.ServerEnabled) {
                            var logData = {
                                logUrl: window.location.href,
                                logMessage: args[0]
                            };

                            if (args.length === 2) {
                                logData.logMessage += ' ' + JSON.stringify(args[1]);
                            }

                            //                            console.log('Log Message sent to server ' + LOGGING_CONFIG.LogServerEndpoint + ' :', logData);
                            if (Detection.isOnline) {
                                $.post(LOGGING_CONFIG.LogServerEndpoint, JSON.stringify(logData));
                            }
                        }
                    };

                } catch (loggingError) {
                    // ONLY FOR DEVELOPERS - log the log-failure.
                    throw loggingError;
                }
            }

            /*
            Our calls depend on the $log service methods (http://docs.angularjs.org/api/ng.$log)

            debug() Write a debug message
            error() Write an error message
            info() Write an information message
            log() Write a log message
            warn() Write a warning message
             */
            delegatedLog.log = handleLogMessage(LOGGING_CONFIG.EnabledLogLevel, 'LOG  ', delegatedLog.log);
            delegatedLog.info = handleLogMessage(LOGGING_CONFIG.EnabledInfoLevel, 'INFO ', delegatedLog.info);
            delegatedLog.error = handleLogMessage(LOGGING_CONFIG.EnabledErrorLevel, 'ERROR', delegatedLog.error);
            delegatedLog.warn = handleLogMessage(LOGGING_CONFIG.EnabledWarnLevel, 'WARN ', delegatedLog.warn);
            delegatedLog.debug = handleLogMessage(LOGGING_CONFIG.EnabledDebugLevel, 'DEBUG', delegatedLog.debug);

            return delegatedLog;
        };
    }]);
