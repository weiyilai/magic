
/*
 * Copyright (c) 2023 Thomas Hansen - For license inquiries you can contact thomas@ainiro.io.
 */

// Angular and system imports.
import { Observable, throwError } from 'rxjs';
import { Injectable } from '@angular/core';

// Application specific imports.
import { FileService } from './file.service';
import { HttpService } from 'src/app/services/http.service';
import { CacheService } from 'src/app/services/cache.service';
import { DefaultDatabaseType } from '../models/default-database-type.model';
import { Databases } from '../models/databases.model';
import saveAs from 'file-saver';
import { GeneralService } from './general.service';

/**
 * SQL service allowing you to execute SQL and retrieve meta information about
 * your databases.
 */
@Injectable({
  providedIn: 'root'
})
export class SqlService {

  constructor(
    private httpService: HttpService,
    private fileService: FileService,
    private cacheService: CacheService,
    private generalService: GeneralService) { }

  executeSql(
    databaseType: string,
    database: string,
    sql: string,
    safeMode: boolean,
    batch: boolean) {

    return this.httpService.post<any[]>('/magic/system/sql/evaluate', {
      databaseType,
      database,
      sql,
      safeMode,
      batch
    });
  }

  defaultDatabaseType() {

    return this.httpService.get<DefaultDatabaseType>('/magic/system/sql/default-database-type');
  }

  connectionStrings(databaseType: string) {

    return this.httpService.get<any>('/magic/system/sql/connection-strings?databaseType=' + encodeURIComponent(databaseType));
  }

  getDatabaseMetaInfo(databaseType: string, connectionString: string) {

    return this.httpService.get<Databases>('/magic/system/sql/databases?databaseType=' +
      encodeURIComponent(databaseType) +
      '&connectionString=' +
      connectionString);
  }

  addConnectionString(databaseType: string, name: string, connectionString: string, useAsDefault: boolean = false) {

    return this.httpService.post('/magic/system/sql/connection-string', {
      databaseType,
      name,
      connectionString,
      useAsDefault,
    });
  }

  deleteConnectionString(databaseType: string, connectionStringName: string) {

    return this.httpService.delete('/magic/system/sql/connection-string?databaseType=' + encodeURIComponent(databaseType) + '&name=' +
      encodeURIComponent(connectionStringName));
  }

  listSnippets(databaseType: string) {

    return this.fileService.listFiles(`/etc/${databaseType}/templates/`);
  }

  loadSnippet(databaseType: string, filename: string) {

    if (filename.indexOf('/') !== -1) {
      return throwError(() => new Error('Not a valid filename'));
    }
    filename = `/etc/${databaseType}/templates/` + filename;
    if (!filename.endsWith('.sql')) {
      filename += '.sql';
    }
    return this.fileService.loadFile(filename);
  }

  saveSnippet(databaseType: string, filename: string, content: string) {

    if (filename.indexOf('/') !== -1) {
      return throwError(() => new Error('Not a valid filename'));
    }
    filename = `/etc/${databaseType}/templates/` + filename;
    if (!filename.endsWith('.sql')) {
      filename += '.sql';
    }
    return this.fileService.saveFile(filename, content);
  }

  createDatabase(
    databaseType: string,
    connectionString: string,
    databaseName: string) {

    return new Observable<any>(subscriber => {
      this.httpService.post<any>('/magic/system/sql/ddl/database', {
        databaseType,
        connectionString,
        databaseName,
      }).subscribe({
        next: (result: any) => {

          this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
            next: () => {
              subscriber.next(result);
              subscriber.complete();
            },
            error: (error: any) => {
              subscriber.error(error);
              subscriber.complete();
            }
          });
        },
        error: (error: any) => {

          subscriber.error(error);
          subscriber.complete();
        }
      });
    });
  }

  dropDatabase(
    databaseType: string,
    connectionString: string,
    databaseName: string) {

    return new Observable<any>(subscriber => {
      this.httpService.delete<any>(
        '/magic/system/sql/ddl/database?databaseType=' +
        encodeURIComponent(databaseType) +
        '&connectionString=' +
        encodeURIComponent(connectionString) +
        '&databaseName=' +
        encodeURIComponent(databaseName)).subscribe({
          next: (result) => {

            this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
              next: () => {

                subscriber.next(result);
                subscriber.complete();
              },
              error: (error: any) => {

                subscriber.error(error);
                subscriber.complete();
              }
            });
          },
          error: (error: any) => {

            subscriber.error(error);
            subscriber.complete();
          }
        });
    });
  }

  exportDdl(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tables: string[],
    full: boolean) {

    return this.httpService.post<any>('/magic/system/sql/ddl/export-tables', {
      databaseType,
      connectionString,
      databaseName,
      tables,
      full,
    });
  }

  addTable(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string,
    pkName: string,
    pkType: string,
    pkLength: string,
    pkDefault: string) {

    return new Observable<any>(subscriber => {
      this.httpService.post<any>('/magic/system/sql/ddl/table', {
        databaseType,
        connectionString,
        databaseName,
        tableName,
        pkName,
        pkType,
        pkLength,
        pkDefault
      }).subscribe({
        next: (result) => {

          this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
            next: () => {

              subscriber.next(result);
              subscriber.complete();
            },
            error: (error: any) => {

              subscriber.error(error);
              subscriber.complete();
            }
          });
        },
        error: (error: any) => {

          subscriber.error(error);
          subscriber.complete();
        }
      });
    });
  }

  addLinkTable(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    args: any) {
    return new Observable<any>(subscriber => {
      this.httpService.post<any>('/magic/system/sql/ddl/link-table', {
        databaseType,
        connectionString,
        databaseName,
        args
      }).subscribe({
        next: (result) => {

          this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
            next: () => {

              subscriber.next(result);
              subscriber.complete();
            },
            error: (error: any) => {

              subscriber.error(error);
              subscriber.complete();
            }
          });
        },
        error: (error: any) => {

          subscriber.error(error);
          subscriber.complete();
        }
      });
    });
  }

  dropTable(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string) {

    return new Observable<any>(subscriber => {
      this.httpService.delete<any>(
        '/magic/system/sql/ddl/table?databaseType=' +
        encodeURIComponent(databaseType) +
        '&connectionString=' +
        encodeURIComponent(connectionString) +
        '&databaseName=' +
        encodeURIComponent(databaseName) +
        '&tableName=' +
        encodeURIComponent(tableName)).subscribe({
          next: (result) => {

            this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
              next: () => {

                subscriber.next(result);
                subscriber.complete();
              },
              error: (error: any) => {

                subscriber.error(error);
                subscriber.complete();
              }
            });
          },
          error: (error: any) => {

            subscriber.error(error);
            subscriber.complete();
          }
        });
    });
  }

  addColumn(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string,
    columnName: string,
    columnType: string,
    defaultValue: string,
    nullable: boolean,
    indexed: boolean,
    columnLength: number) {

    return new Observable<any>(subscriber => {
      return this.httpService.post<any>('/magic/system/sql/ddl/column', {
        databaseType,
        connectionString,
        databaseName,
        tableName,
        columnName,
        columnType,
        defaultValue,
        nullable,
        indexed,
        columnLength
      }).subscribe({
        next: (result) => {

          this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
            next: () => {

              subscriber.next(result);
              subscriber.complete();
            },
            error: (error: any) => {

              subscriber.error(error);
              subscriber.complete();
            }
          });
        },
        error: (error: any) => {

          subscriber.error(error);
          subscriber.complete();
        }
      });
    });
  }

  addReferencedColumn(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string,
    columnName: string,
    columnType: string,
    foreignTable: string,
    foreignField: string,
    nullable: boolean,
    columnLength: number,
    cascading: boolean) {

    return new Observable<any>(subscriber => {
      this.httpService.post<any>('/magic/system/sql/ddl/column', {
        databaseType,
        connectionString,
        databaseName,
        tableName,
        columnName,
        columnType,
        foreignTable,
        foreignField,
        nullable,
        columnLength,
        cascading,
      }).subscribe({
        next: (result) => {

          this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
            next: () => {

              subscriber.next(result);
              subscriber.complete();
            },
            error: (error: any) => {

              subscriber.error(error);
              subscriber.complete();
            }
          });
        },
        error: (error: any) => {

          subscriber.error(error);
          subscriber.complete();
        }
      });
    });
  }

  deleteColumn(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string,
    columnName: string) {

    return new Observable<any>(subscriber => {

      this.httpService.delete<any>('/magic/system/sql/ddl/column?databaseType=' +
        encodeURIComponent(databaseType) +
        '&connectionString=' +
        encodeURIComponent(connectionString) +
        '&databaseName=' +
        encodeURIComponent(databaseName) +
        '&tableName=' +
        encodeURIComponent(tableName) +
        '&columnName=' +
        encodeURIComponent(columnName)).subscribe({
          next: (result) => {

            this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
              next: () => {

                subscriber.next(result);
                subscriber.complete();
              },
              error: (error: any) => {

                subscriber.error(error);
                subscriber.complete();
              }
            });
          },
          error: (error: any) => {

            subscriber.error(error);
            subscriber.complete();
          }
        })
    });
  }

  deleteFk(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string,
    fkName: string) {

    return this.httpService.delete<any>('/magic/system/sql/ddl/foreign-key?databaseType=' +
      encodeURIComponent(databaseType) +
      '&connectionString=' +
      encodeURIComponent(connectionString) +
      '&databaseName=' +
      encodeURIComponent(databaseName) +
      '&tableName=' +
      encodeURIComponent(tableName) +
      '&fkName=' +
      encodeURIComponent(fkName));
  }

  deleteIndex(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string,
    indexName: string) {

    return new Observable<any>(subscriber => {

      this.httpService.delete<any>('/magic/system/sql/ddl/index?databaseType=' +
        encodeURIComponent(databaseType) +
        '&connectionString=' +
        encodeURIComponent(connectionString) +
        '&databaseName=' +
        encodeURIComponent(databaseName) +
        '&tableName=' +
        encodeURIComponent(tableName) +
        '&indexName=' +
        encodeURIComponent(indexName)).subscribe({
          next: (result) => {

            this.cacheService.delete('magic.sql.databases.' + databaseType + '.' + connectionString + '.*').subscribe({
              next: () => {

                subscriber.next(result);
                subscriber.complete();
              },
              error: (error: any) => {

                subscriber.error(error);
                subscriber.complete();
              }
            });
          },
          error: (error: any) => {

            subscriber.error(error);
            subscriber.complete();
          }
        })
    });
  }

  exportToModule(
    databaseType: string,
    module: string,
    sql: string) {
    return this.httpService.post<any>('/magic/system/sql/ddl/export-to-module', {
      databaseType,
      module,
      sql,
    });
  }

  createMigrationScript(
    databaseType: string,
    module: string,
    sql: string) {
    return this.httpService.post<any>('/magic/system/sql/ddl/create-migration-script', {
      databaseType,
      module,
      sql,
    });
  }

  importCsvFile(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    file: any) {

    const formData: FormData = new FormData();
    formData.append('databaseType', databaseType);
    formData.append('connectionString', connectionString);
    formData.append('databaseName', databaseName);
    formData.append('file', file);
    return this.httpService.post<any>('/magic/system/sql/import-csv-file', formData);
  }

  exportTableAsCsvFile(
    databaseType: string,
    connectionString: string,
    databaseName: string,
    tableName: string) {

      this.httpService.download(
        '/magic/system/sql/export-as-csv-file?databaseType=' +
        encodeURIComponent(databaseType) + 
        '&connectionString=' + encodeURIComponent(connectionString) +
        '&databaseName=' + encodeURIComponent(databaseName) +
        '&tableName=' + encodeURIComponent(tableName))
        .subscribe({

          next: (res) => {
    
            let filename = tableName + '.csv';
            const file = new Blob([res.body]);
            saveAs(file, filename);
            this.generalService.hideLoading();
          },
    
          error: (error: any) => {

            this.generalService.showFeedback(error?.error?.message ?? error, 'errorMessage', 'Ok', 4000);
            this.generalService.hideLoading();
          }
        });
    }
}
