
/*
 * Copyright (c) 2023 Thomas Hansen - For license inquiries you can contact thomas@ainiro.io.
 */

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, from, Observable, Subscription } from 'rxjs';
import { Model } from 'src/app/components/protected/common/codemirror-sql/codemirror-sql.component';
import { ShortkeysDialogComponent } from 'src/app/components/protected/common/shortkeys-dialog/shortkeys-dialog.component';
import { GeneralService } from 'src/app/services/general.service';
import { saveAs } from 'file-saver';

// CodeMirror options.
import { CodemirrorActionsService } from 'src/app/services/codemirror-actions.service';
import { SqlService } from 'src/app/services/sql.service';
import { SqlSnippetDialogComponent } from './components/load-sql-snippet-dialog/load-sql-snippet-dialog.component';
import { SaveSnippetDialogComponent } from '../../../../common/save-snippet-dialog/save-snippet-dialog.component';

/**
 * Helper component to allo user to view his database in SQL view, as in allowing to
 * write and execute SQL towards his currently open database in SQL Studio.
 */
@Component({
  selector: 'app-sql-view',
  templateUrl: './sql-view.component.html',
  styleUrls: ['./sql-view.component.scss']
})
export class SqlViewComponent implements OnInit, OnDestroy {

  private selectedSnippet: string = '';
  private tablesList: any = null;
  private tableSubscription!: Subscription;
  private actionSubscription!: Subscription;
  formatResultView: boolean = false;

  @Input() hintTables: Observable<any[]>;
  @Input() selectedDatabase: string = '';
  @Input() selectedDbType: string = '';
  @Input() selectedConnectionString: string = '';
  @Output() getDatabases: EventEmitter<any> = new EventEmitter<any>();
  @Input() databases: any = null;
  input: Model = null;
  queryResult: any = [];
  displayedColumns: any = [];
  executingSql: boolean = false;
  sqlFile: any;
  safeMode: boolean = true;

  constructor(
    private dialog: MatDialog,
    private sqlService: SqlService,
    private generalService: GeneralService,
    private codemirrorActionsService: CodemirrorActionsService) { }

  ngOnInit() {

    this.codeMirrorInit();
    this.watchForActions();
    this.tableSubscription = this.hintTables.subscribe((res: any) => {
      this.tablesList = res;
      if (this.input) {
        this.input.options.hintOptions = {
          tables: this.tablesList,
        };
      }
    });
  }

  async createAiContext() : Promise<string> {

    const db = this.databases.filter(x => x.name === this.selectedDatabase)[0];

    if (!db.tables) {

      let dialect = '';
      switch (this.selectedDbType) {
        case 'sqlite':
          dialect = 'SQLite';
          break;
        case 'mysql':
          dialect = 'MySQL';
          break;
        case 'mssql':
          dialect = 'Microsoft SQL Server';
          break;
        case 'pgsql':
          dialect = 'PostgreSQL';
          break;
      }
      let retVal = 'SQL dialect: ' + dialect + '\n\n';
      if (this.input.sql && this.input.sql.length > 0) {
        retVal += 'Current code: \n\n' + this.input.sql;
      }
      return retVal;

    } else {

      let result: any = await firstValueFrom(this.sqlService.exportDdl(
        this.selectedDbType,
        this.selectedConnectionString,
        this.selectedDatabase,
        db.tables.map((table: any) => table.name),
        true));
      let dialect = '';
      switch (this.selectedDbType) {
        case 'sqlite':
          dialect = 'SQLite';
          break;
        case 'mysql':
          dialect = 'MySQL';
          break;
        case 'mssql':
          dialect = 'Microsoft SQL Server';
          break;
        case 'pgsql':
          dialect = 'PostgreSQL';
          break;
      }
      let retVal = 'Current schema:\n\n' + result.result + '\n\n' + 'SQL dialect: ' + dialect + '\n\n';
      if (this.input.sql && this.input.sql.length > 0) {
        retVal += 'Current code: \n\n' + this.input.sql;
      }
      return retVal;
    }
  }

  shouldFormat(cell: any) {

    return this.formatResultView && cell && typeof cell === 'string' && cell.indexOf('\n') !== -1;
  }

  codeMirrorInit() {

    this.input = {
      databaseType: this.selectedDatabase,
      connectionString: this.selectedConnectionString,
      database: this.selectedDatabase,
      options: this.getCodeMirrorOptions(),
      sql: '',
    };
    this.input.options.hintOptions = {
      tables: this.tablesList,
    };
    this.input.options.autofocus = true;
  }

  loadSnippet() {

    this.dialog.open(SqlSnippetDialogComponent, {
      width: '550px',
      data: this.selectedDbType,
    }).afterClosed().subscribe((filename: string) => {
      if (filename) {
        this.selectedSnippet = filename;

        this.generalService.showLoading();
        this.sqlService.loadSnippet(this.selectedDbType, filename).subscribe({
          next: (content: string) => {

            this.generalService.hideLoading();
            this.input.sql = content;
          },
          error: (error: any) => {

            this.generalService.hideLoading();
            this.generalService.showFeedback(error?.error?.message ?? error, 'errorMessage');
          }
        })
      }
    });
  }

  save() {

    if (!this.input?.sql && this.input.sql === '') {
      this.generalService.showFeedback('Write some SQL first, then save it', 'errorMessage', 'Ok', 5000)
      return;
    }

    this.dialog.open(SaveSnippetDialogComponent, {
      width: '550px',
      data: this.selectedSnippet
    }).afterClosed().subscribe((filename: string) => {
      if (filename) {
        this.generalService.showLoading();
        this.sqlService.saveSnippet(
          this.selectedDbType,
          filename,
          this.input.sql).subscribe(
            {
              next: () => {

                this.generalService.showFeedback('SQL snippet successfully saved.', 'successMessage');
                this.selectedSnippet = filename;
                this.generalService.hideLoading();
              },
              error: (error: any) => {

                this.generalService.showFeedback(error?.error?.message ?? error, 'errorMessage');
                this.generalService.hideLoading();
              }
            });
      }
    });
  }

  insertFromOpenAI(snippet: string) {

    this.input.sql = snippet;
  }

  execute() {

    if (!this.input.sql && this.input.sql === '') {
      this.generalService.showFeedback('Write some SQL first, then execute it', 'errorMessage', 'Ok', 5000)
      return;
    }
    if (this.input && this.input.editor) {
      this.executingSql = true;
      const selectedText = this.input.editor.getSelection();
      const toBeExecuted = selectedText == '' ? this.input.sql : selectedText;
      const batch = this.selectedDbType === 'mssql' && toBeExecuted.includes('go');
      this.generalService.showLoading();
      this.sqlService.executeSql(
        this.selectedDbType,
        '[' + this.selectedConnectionString + '|' + this.selectedDatabase + ']',
        toBeExecuted,
        this.safeMode,
        batch).subscribe({
          next: (result: any[][]) => {

            if (result) {
              let count = 0;
              for (var idx of result) {
                count += (idx || []).length;
              }
              if (count === 200) {
                this.generalService.showFeedback('First 200 records returned. Turn off safe mode to return all records.', 'successMessage');
              } else {
                this.generalService.showFeedback(`${count} records returned`);
              }
            } else {
              this.generalService.showFeedback('SQL successfully executed, but returned no result', 'successMessage', 'Ok', 5000);
            }
            this.queryResult = result || [];

            this.buildTable();
            this.generalService.hideLoading();
            this.executingSql = false;
          },
          error: (error: any) => {

            this.executingSql = false;
            this.generalService.hideLoading();
            if (error.error &&
              error?.error?.message &&
              error?.error?.message &&
              (<string>error?.error?.message).toLowerCase().indexOf('incorrect syntax near \'go\'') !== -1) {
              this.generalService.showFeedback('Turn ON batch mode to execute this SQL', 'errorMessage', 'Ok', 5000);
              return;
            }
            this.generalService.showFeedback(error?.error?.message ?? error, 'errorMessage', 'Ok', 5000);
          }
        });
    }
  }

  importSqlFile(event: any) {

    this.sqlFile = event.target.files[0];
    let fileReader = new FileReader();

    fileReader.onload = (e) => {
      this.input.sql = <any>fileReader.result;
    }

    fileReader.readAsText(this.sqlFile);
    this.sqlFile = '';
  }

  exportAsCsv(result: any) {

    let content = '';
    let firstHeader = true;
    for (const idxHeader in result[0]) {
      if (firstHeader) {
        firstHeader = false;
      } else {
        content += ',';
      }
      content += idxHeader;
    }
    content += '\r\n';
    for (const idxRow of result) {
      let firstItem = true;
      for (const idxHeader in idxRow) {
        if (firstItem) {
          firstItem = false;
        } else {
          content+= ',';
        }
        const value = idxRow[idxHeader];
        if (typeof value === 'string') {
          var idxContent = idxRow[idxHeader];
          while (idxContent.indexOf('"') !== -1) {
            idxContent = idxContent.replace('"', '""');
          }
          content += '"' + idxContent + '"';
        } else {
          content += idxRow[idxHeader];
        }
      }
      content += '\r\n';
    }
    this.saveAsFile(content, 'sql-export.csv', 'text/csv');
  }

  viewShortkeys() {

    this.dialog.open(ShortkeysDialogComponent, {
      width: '900px',
      data: {
        type: ['save', 'execute', 'insertSnippet'],
      }
    });
  }

  ngOnDestroy() {

    this.tableSubscription?.unsubscribe();
    this.actionSubscription?.unsubscribe();
  }

  /*
   * Private helper methods.
   */

  private saveAsFile(buffer: any, fileName: string, fileType: string) {

    const data: Blob = new Blob([buffer], { type: fileType });
    saveAs(data, fileName);
  }

  private buildTable() {

    if (this.queryResult && this.queryResult.length > 0) {
      this.displayedColumns = [];

      this.queryResult.forEach((element: any, index: number) => {
        if (element) {
          this.displayedColumns[index] = Object.keys(element[0]);
        }
      });
    }
  }

  private watchForActions() {

    this.actionSubscription = this.codemirrorActionsService.action.subscribe((action: string) => {

      switch (action) {

        case 'save':
          this.save();
          break;

        case 'insertSnippet':
          this.loadSnippet();
          break;

        case 'execute':
          this.execute();
          break;

        default:
          break;
      }
    });
  }

  private getCodeMirrorOptions() {

    return this.codemirrorActionsService.getActions(null, 'sql');
  }
}
