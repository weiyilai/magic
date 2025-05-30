
/*
 * Copyright (c) 2023 Thomas Hansen - For license inquiries you can contact thomas@ainiro.io.
 */

import { formatNumber } from '@angular/common';
import { Component, Inject, LOCALE_ID, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { GeneralService } from 'src/app/services/general.service';
import { CrudifyService } from 'src/app/services/crudify.service';
import { TransformModelService } from 'src/app/services/transform-model.service';
import { LogService } from 'src/app/services/log.service';
import { CommonErrorMessages } from 'src/app/helpers/common-error-messages';
import { CommonRegEx } from 'src/app/helpers/common-regex';

// CodeMirror options.
import { MessageService } from 'src/app/services/message.service';
import { ActivatedRoute } from '@angular/router';
import { SqlService } from 'src/app/services/sql.service';
import { GeneratorBase } from '../generator-base';
import { RoleService } from '../../../manage/user-and-roles/_services/role.service';
import { LocResult } from 'src/app/models/loc-result.model';
import { SingleTableConfigComponent } from './components/single-table-config/single-table-config.component';

/**
 * Auto endpoint generator, automatically wrapping your database tables in CRUD endpoints.
 */
@Component({
  selector: 'app-crud-generator',
  templateUrl: './crud-generator.component.html'
})
export class CRUDGeneratorComponent extends GeneratorBase implements OnInit {

  @ViewChild(SingleTableConfigComponent) singleTableConfig! : SingleTableConfigComponent;

  CommonRegEx = CommonRegEx;
  CommonErrorMessages = CommonErrorMessages;

  selectedTables: FormControl = new FormControl<any>('');
  readRoles: FormControl = new FormControl<any>('');
  updateRoles: FormControl = new FormControl<any>('');
  deleteRoles: FormControl = new FormControl<any>('');
  createRoles: FormControl = new FormControl<any>('');
  primaryURL: string = '';
  secondaryURL: string = '';
  paging: boolean = true;
  sorting: boolean = true;
  logCreate: boolean = false;
  logUpdate: boolean = false;
  logDelete: boolean = false;
  captchaValue: number;
  captchaCreate: boolean = false;
  captchaRead: boolean = false;
  captchaUpdate: boolean = false;
  captchaDelete: boolean = false;
  cacheDuration: boolean = false;
  cachePublic: boolean = false;
  publishSocketMessages: boolean = false;
  socketAuthorisationTypes: string[] = ['none', 'inherited', 'roles'];
  socketAuthorisationTypeValue: string;
  socketAuthorisationRoles: FormControl = new FormControl<any>('');
  availableTables: any[] = [];

  constructor(
    private logService: LogService,
    protected sqlService: SqlService,
    private messageService: MessageService,
    protected generalService: GeneralService,
    protected activatedRoute: ActivatedRoute,
    private crudifyService: CrudifyService,
    protected roleService: RoleService,
    protected transformService: TransformModelService,
    @Inject(LOCALE_ID) public locale: string) {

      super(generalService, roleService, activatedRoute, sqlService);
    }

  ngOnInit() {

    this.init();
  }

  changeDbType() {

    this.getConnectionString();
  }

  changeConnectionString() {

    this.getDatabases();
  }

  changeDatabase() {

    // Finding table names from currently selected database catalog.
    const db = this.databases.find((item: any) => item.name === this.selectedDatabase);

    if (db?.tables?.length) {

      this.availableTables = this.databases.find((item: any) => item.name === this.selectedDatabase).tables;
      let names: string[] = this.availableTables.map((item: any) => { return item.name });
      this.selectedTables.setValue(names);

      if (this.availableTables.length === 1) {

        this.secondaryURL = this.selectedTables.value.toString().toLowerCase()
      }

    } else {

      this.selectedTables.setValue([]);
    }

    // Making sure we correctly trigger update of child component.
    setTimeout(() => {
      if (this.singleTableConfig) {
        this.singleTableConfig.watchDbLoading();
      }
    },1);

    // Using database name as default primary URL of endpoints.
    this.primaryURL = this.selectedDatabase;
  }

  selectedTableChanged() {

    this.selectedTables.value.length === 1 ?
      this.secondaryURL = this.selectedTables.value.toString().toLowerCase() :
      '';
  }

  toggleAllTables(checked: boolean) {

    if (!checked) {
      this.selectedTables.setValue('');
    } else {
      let names: any = this.availableTables.map((item: any) => { return item.name });
      this.selectedTables.setValue(names);
    }
  }

  generateEndpoints() {

    // Making sure user has selected at least one table before proceeding.
    if (this.selectedTables.value.length == 0) {
      this.generalService.showFeedback('Please select one or more table(s) before you generate endpoints', 'errorMessage');
      return;
    }

    // Showing loader to user.
    this.generalService.showLoading();

    // List of endpoint invocations we forkJoin further down in method.
    const observables: Observable<LocResult>[] = [];

    // Finding selected database.
    const db: any = this.databases
      .find((db: any) => db.name === this.selectedDatabase);

    // Finding selected tables.
    const selectedTables: any[] = db
      .tables
      .filter((x: any) => this.selectedTables.value.indexOf(x.name) > -1);

    // Decorating options for selected tables.
    this.createDefaultOptions(db, selectedTables);

    // Looping through all selected tables.
    for (const idxTable of selectedTables) {

      // Making sure we don't generate verbs that doesn't have at least one column.
      for (const idxVerb of idxTable.verbs) {
        idxVerb.generate = idxTable.columns.filter((x: any) => x[idxVerb.name]).length > 0;
        switch (idxVerb.name) {
          case 'delete': idxTable.logDelete = this.logDelete; break;
          case 'post': idxTable.logPost = this.logCreate; break;
          case 'put': idxTable.logPut = this.logUpdate; break;
          case 'get':
            idxTable.paging = this.paging;
            idxTable.sorting = this.sorting;
            idxTable.aggregate = this.transformService.aggregates;
            idxTable.distinct = this.transformService.distinct;
            idxTable.search = this.transformService.search;
            break;
        }
      }

      // Applying reCAPTCHA for POST verb if requested by user.
      if (this.captchaCreate) {
        idxTable.captchaPost = this.captchaValue;
      } else {
        delete idxTable.captchaPost;
      }

      // Applying reCAPTCHA for GET verb if requested by user.
      if (this.captchaRead) {
        idxTable.captchaGet = this.captchaValue;
      } else {
        delete idxTable.captchaGet;
      }

      // Applying reCAPTCHA for PUT verb if requested by user.
      if (this.captchaUpdate) {
        idxTable.captchaPut = this.captchaValue;
      } else {
        delete idxTable.captchaPut;
      }

      // Applying reCAPTCHA for DELETE verb if requested by user.
      if (this.captchaDelete) {
        idxTable.captchaDelete = this.captchaValue;
      } else {
        delete idxTable.captchaDelete;
      }

      // Applying publish socket messages if user requested it.
      idxTable.cqrs = this.publishSocketMessages;
      if (this.publishSocketMessages) {
        idxTable.cqrsAuthorisation = this.socketAuthorisationTypeValue;
        if (this.socketAuthorisationTypeValue === 'roles' && this.socketAuthorisationRoles.value) {
          idxTable.cqrsAuthorisationValues = this.socketAuthorisationRoles.value.join(',');
        }
      }

      // Iterating through all enabled verbs, creating our observables.
      observables.push(...idxTable.verbs.filter((method: any) => method.generate).map((method: any) => {
        return this.crudifyService.crudify(
          this.transformService.transform(
            this.selectedDbType,
            '[' + this.selectedConnectionString + '|' + this.selectedDatabase + ']',
            idxTable,
            method.name));
      }));
    }

    // Invoking every single endpoint observable.
    forkJoin(observables).subscribe({
      next: (results: LocResult[]) => {

        const loc = results.reduce((x, y) => x + y.loc, 0);
        this.logService.createLocItem(loc, 'backend', `${this.selectedDatabase}`).subscribe({
          next: () => {

            this.generalService.showFeedback(`${formatNumber(loc, this.locale, '1.0')} lines of code generated.`, 'successMessage');
            this.messageService.sendMessage({
              name: 'magic.folders.update',
              content: '/modules/'
            });
            this.generalService.hideLoading();
          },
          error: (error: any) => {

            this.generalService.hideLoading();
            this.generalService.showFeedback(error?.error?.message ?? error, 'errorMessage', 'Ok', 4000)
          }
        });

      },
      error: (error: any) => {

        this.generalService.hideLoading();
        this.generalService.showFeedback(error?.error?.message ?? error, 'errorMessage', 'Ok', 4000);
      }
    });
  }

  /*
   * Protected implementations of base class methods.
   */

  protected databaseLoaded() {

    this.changeDatabase();
    this.readRoles.setValue(['root', 'admin']);
    this.updateRoles.setValue(['root', 'admin']);
    this.deleteRoles.setValue(['root', 'admin']);
    this.createRoles.setValue(['root', 'admin']);
  }

  /*
   * Private helper methods.
   */

  private createDefaultOptions(db: any, tables: any[]) {

    // Iterating through each table specified by caller.
    for (const idxTable of tables) {

      // Correcting model for columns user wants to apply "row level security" on.
      for (const col of idxTable.columns || []) {
        if (col.locked === true) {
          col.locked = 'auth.ticket.get';
        }
      }

      // Applying verbs for table.
      const columns = idxTable.columns || [];
      idxTable.verbs = [
        { name: 'post', generate: columns.length > 0 },
        { name: 'get', generate: columns.length > 0 },
      ];
      if (columns.filter((x: any) => !x.primary).length > 0 &&
        columns.filter((x: any) => x.primary).length > 0) {
        idxTable.verbs.push({ name: 'put', generate: columns.filter((x: any) => !x.primary && !x.automatic).length > 0 });
      }
      if (columns.filter((x: any) => x.primary).length > 0) {
        idxTable.verbs.push({ name: 'delete', generate: true });
      }

      // Applying suthorisation requirements for verbs.
      idxTable.authPost = this.createRoles.value.toString();
      idxTable.authGet = this.readRoles.value.toString();
      idxTable.authPut = this.updateRoles.value.toString();
      idxTable.authDelete = this.deleteRoles.value.toString();

      // Applying socket publishing authorisation requirements.
      idxTable.cqrsAuthorisation = this.publishSocketMessages === true && this.socketAuthorisationTypeValue !== '' ?
        this.socketAuthorisationTypeValue :
        'inherited';
      idxTable.cqrsAuthorisationValues =
        this.publishSocketMessages === true && this.socketAuthorisationTypeValue !== '' && this.socketAuthorisationRoles.value.length > 0 ?
          this.socketAuthorisationRoles.value.toString() :
          null;

      // Applying cache settings.
      idxTable.cache = this.cacheDuration;
      idxTable.publicCache = this.cachePublic;

      // Applying primary URL.
      idxTable.moduleName = this.primaryURL;

      /*
       * Notice, if we are generating more than one table, we need to apply default values for fields,
       * according to database name, table names, etc.
       * 
       * If only one table is crudified, we use whatever input user supplied
       */
      if (this.selectedTables.value.length === 1) {

        // Notice, if only one table is crudified, we use textbox input as URL.
        idxTable.moduleUrl = this.secondaryURL;

      } else  {

        // If more than one table is crudified, we default URLs to table name.
        idxTable.moduleUrl = idxTable.name;

        // Iterating through each column of currently iterated table.
        for (const idxColumn of columns) {

          // Figuring out if current column is a foreign key.
          const keys = idxTable.foreign_keys?.filter((foreign_key: any) => foreign_key.column === idxColumn.name) ?? [];
          if (keys.length > 0) {

            // Finding foreign table.
            const foreignTable = db.tables.find((x: any) => x.name === keys[0].foreign_table);

            // Notice, we only create a FK reference if we can find a string field in foreign table.
            if (foreignTable.columns.find((x: any) => x.hl === 'string')) {
              idxColumn.foreign_key = {
                foreign_table: keys[0].foreign_table,
                foreign_column: keys[0].foreign_column,
                long_data: true,
                foreign_name: foreignTable.columns.filter((x: any) => x.hl === 'string')[0].name,
              };
            }
          }

          idxColumn.post = !(idxColumn.automatic && idxColumn.primary);
          if (idxColumn.automatic && (idxColumn.name?.toLowerCase() === 'created' || idxColumn.name?.toLowerCase() === 'last_update')) {
            idxColumn.post = false;
          }
          idxColumn.get = true;
          idxColumn.put = !idxColumn.automatic || idxColumn.primary;
          idxColumn.delete = idxColumn.primary;

          idxColumn.postDisabled = false;
          idxColumn.getDisabled = false;
          idxColumn.putDisabled = idxColumn.primary;
          idxColumn.deleteDisabled = true;

          if ((idxColumn.name === 'user' || idxColumn.name === 'username') && idxColumn.hl === 'string') {
            idxColumn.locked = 'auth.ticket.get';
          }

          if (idxColumn.name?.toLowerCase() === 'picture' || idxColumn.name?.toLowerCase() === 'image' || idxColumn.name?.toLowerCase() === 'photo') {
            idxColumn.handling = 'image';
          }

          if (idxColumn.name?.toLowerCase() === 'file') {
            idxColumn.handling = 'file';
          }

          if (idxColumn.name?.toLowerCase() === 'youtube' || idxColumn.name?.toLowerCase() === 'video') {
            idxColumn.handling = 'youtube';
          }

          if (idxColumn.name?.toLowerCase() === 'email' || idxColumn.name?.toLowerCase() === 'mail') {
            idxColumn.handling = 'email';
          }

          if (idxColumn.name?.toLowerCase() === 'url' || idxColumn.name?.toLowerCase() === 'link') {
            idxColumn.handling = 'url';
          }

          if (idxColumn.name?.toLowerCase() === 'phone' || idxColumn.name?.toLowerCase() === 'tel') {
            idxColumn.handling = 'phone';
          }
        }
      }
    }
  }
}
