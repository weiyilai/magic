
/*
 * Copyright (c) 2023 Thomas Hansen - For license inquiries you can contact thomas@ainiro.io.
 */

import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Count } from 'src/app/models/count.model';
import { ConfirmationDialogComponent } from 'src/app/components/protected/common/confirmation-dialog/confirmation-dialog.component';
import { OpenAIConfigurationDialogComponent } from 'src/app/components/protected/common/openai/openai-configuration-dialog/openai-configuration-dialog.component';
import { GeneralService } from 'src/app/services/general.service';
import { MachineLearningTrainingService } from 'src/app/services/machine-learning-training.service';
import { OpenAIService } from 'src/app/services/openai.service';
import { MachineLearningEditTypeComponent } from '../components/machine-learning-edit-type/machine-learning-edit-type.component';
import { MachineLearningEmbedUiComponent } from '../components/machine-learning-embed-ui/machine-learning-embed-ui.component';
import { MachineLearningImportComponent } from '../components/machine-learning-import/machine-learning-import.component';
import { MachineLearningTestComponent } from '../components/machine-learning-test/machine-learning-test.component';
import { MachineLearningTrainComponent } from '../components/machine-learning-train/machine-learning-train.component';
import { MachineLearningImportFeedbackComponent } from '../components/machine-learning-import-feedback/machine-learning-import-feedback.component';

/**
 * Helper component to manage machine learning types, different models, and configurations
 * for your types.
 */
@Component({
  selector: 'app-machine-learning-types',
  templateUrl: './machine-learning-types.component.html',
  styleUrls: ['./machine-learning-types.component.scss']
})
export class MachineLearningModelsComponent implements OnInit {

  @Input() isConfigured: boolean = false;
  @Output() isConfiguredChange = new EventEmitter<boolean>();

  importing: boolean = false;
  count: number = 0;
  filter: any = {
    limit: 10,
    offset: 0,
  };
  isLoadingKey: boolean = false;
  displayedColumns: string[] = [
    'type',
    'model',
    'action',
  ];
  types: any[] = null;

  constructor(
    private dialog: MatDialog,
    private openAIService: OpenAIService,
    private generalService: GeneralService,
    private machineLearningTrainingService: MachineLearningTrainingService) { }

  ngOnInit() {

    this.isLoadingKey = true;
    this.getConfiguredStatus();
  }

  filterList(event: { searchKey: string }) {

    this.filter = {
      limit: this.filter.limit,
      offset: 0,
    };
    if (event.searchKey) {
      this.filter['ml_types.type.like'] = '%' + event.searchKey + '%';
    }
    this.getModels(true);
  }

  page(event: PageEvent) {

    this.filter.offset = event.pageIndex * event.pageSize;
    this.getModels(false);
  }

  sortData(e: any) {

    if (e.direction === '') {

      delete this.filter['order'];
      delete this.filter['direction'];
      this.getModels();
      return;
    }

    this.filter['order'] = e.active;
    this.filter['direction'] = e.direction;
    this.getModels();
  }

  configure() {

    this.dialog
      .open(OpenAIConfigurationDialogComponent, {
        width: '80vw',
        maxWidth: '550px',
      })
      .afterClosed()
      .subscribe((result: {configured: boolean}) => {

        if (result?.configured) {
          this.isConfigured = true;
          this.isConfiguredChange.emit(this.isConfigured);
          this.getModels();
        }
      });
  }

  addType() {

    this.dialog
      .open(MachineLearningEditTypeComponent, {
        width: '80vw',
        maxWidth: '950px',
      })
      .afterClosed()
      .subscribe((result: any) => {

        if (result) {

          this.generalService.showLoading();
          this.machineLearningTrainingService.ml_types_create(result).subscribe({
            next: () => {

              this.getModels();
              this.generalService.showFeedback('Model successfully saved', 'successMessage');
            },
            error: (error: any) => {

              this.generalService.hideLoading();
              this.generalService.showFeedback(error?.error?.message ?? 'Something went wrong', 'errorMessage', 'Ok', 10000);
            }
          });
        }
    });
  }

  import(el: any) {

    this.dialog
      .open(MachineLearningImportComponent, {
        width: '80vw',
        maxWidth: '1280px',
        data: el,
      }).afterClosed()
      .subscribe((result: {
        train?: boolean,
        crawl?: string,
        delay?: number,
        max?: number,
        threshold?: number,
        vectorize?: boolean,
        summarize?: boolean,
        insert_url?: boolean,
        images?: boolean,
        code?: boolean,
        lists?: boolean,
        urlFiles?: any[],
      }) => {

        if (result?.crawl) {

          // Crawling a single URL.
          this.dialog
            .open(MachineLearningImportFeedbackComponent, {
              width: '80vw',
              maxWidth: '1280px',
              data: {
                url: result.crawl,
                type: el.type,
                delay: result.delay,
                max: result.max,
                threshold: result.threshold,
                summarize: result.summarize,
                insert_url: result.insert_url,
                images: result.images ?? true,
                code: result.code ?? true,
                lists: result.lists ?? true,
                mode: 'site',
              }
            });
        } else if (result?.urlFiles) {

          // Opening up dialog without a specified URL.
          this.dialog
            .open(MachineLearningImportFeedbackComponent, {
              width: '80vw',
              maxWidth: '1280px',
              data: {
                urlList: result.urlFiles,
                type: el.type,
                mode: 'url-list',
                vectorize: result.vectorize,
              }
            });
        }
      });
  }

  train(el: any) {

    this.dialog
      .open(MachineLearningTrainComponent, {
        width: '80vw',
        maxWidth: '550px',
        data: el,
      })
      .afterClosed()
      .subscribe((result: any) => {

        if (result) {

          this.generalService.showLoading();
          this.openAIService.start_training(result).subscribe({
            next: () => {

              this.generalService.hideLoading();
              this.generalService.showFeedback('Training successfully started', 'successMessage');
            },
            error: () => {

              this.generalService.hideLoading();
              this.generalService.showFeedback('Something went wrong as we tried to start training', 'errorMessage');
            }
          });
        }
    });
  }

  vectorise(el: any) {

    this.generalService.showLoading();
    this.machineLearningTrainingService.ml_training_snippets_count({
      ['ml_training_snippets.type.eq']: el.type,
      ['not_embedded']: true,
    }).subscribe({
      next: (result: Count) => {

        this.generalService.hideLoading();
        if (result.count === 0) {

          // Asking user to confirm action.
          this.dialog.open(ConfirmationDialogComponent, {
            width: '500px',
            data: {
              title: 'Confirm operation',
              description_extra: `Model called; <span class="fw-bold">${el.type}</span> has no snippets that aren't vectorized, do you want to destroy its existing vectors and re-vectorize it?`,
              action_btn: 'Yes',
              close_btn: 'Cancel',
              bold_description: true
            }
          }).afterClosed().subscribe((result: string) => {

            if (result === 'confirm') {

              // Destroying existing vectors first.
              this.generalService.showLoading();
              this.machineLearningTrainingService.destroyVectors(el.type).subscribe({

                next: () => {

                  this.generalService.hideLoading();
                  this.generalService.showFeedback('Existing vectors were successfully deleted', 'successMessage');

                  // Vectorizing all training snippets for model.
                  this.dialog
                  .open(MachineLearningImportFeedbackComponent, {
                    width: '80vw',
                    maxWidth: '1280px',
                    data: {
                      url: result,
                      type: el.type,
                      mode: 'vectorize'
                    }
                  });
                },

                error: () => {

                  this.generalService.hideLoading();
                  this.generalService.showFeedback('Something went wrong as we tried to delete embeddings for model', 'errorMessage');
                }
              });
            }
          });

        } else {

          // Asking user to confirm action.
          this.dialog.open(ConfirmationDialogComponent, {
            width: '500px',
            data: {
              title: 'Confirm operation',
              description_extra: `Do you want to vectorise the model called; <span class="fw-bold">${el.type}</span><br/>It has ${result.count} snippets`,
              action_btn: 'Vectorise',
              close_btn: 'Cancel',
              bold_description: true
            }
          }).afterClosed().subscribe((result: string) => {

            if (result === 'confirm') {
              this.dialog
              .open(MachineLearningImportFeedbackComponent, {
                width: '80vw',
                maxWidth: '1280px',
                data: {
                  url: result,
                  type: el.type,
                  mode: 'vectorize'
                }
              });
            }
          });
        }
      },

      error: () => {

        this.generalService.hideLoading();
        this.generalService.showFeedback('Something went wrong as we tried to create embeddings for model', 'errorMessage');
      }
    });
  }

  test(el: any) {

    this.dialog
      .open(MachineLearningTestComponent, {
        width: '80vw',
        maxWidth: '850px',
        data: el,
      });
  }

  edit(el: any) {

    this.dialog
      .open(MachineLearningEditTypeComponent, {
        width: '80vw',
        maxWidth: '950px',
        data: el,
      })
      .afterClosed()
      .subscribe((result: any) => {

        if (result) {

          this.generalService.showLoading();
          this.machineLearningTrainingService.ml_types_update(result).subscribe({
            next: () => {

              this.getModels();
              this.generalService.showFeedback('Model successfully saved', 'successMessage');
            },
            error: () => {

              this.generalService.hideLoading();
              this.generalService.showFeedback('Something went wrong as we tried to edit your type', 'errorMessage');
            }
          });
        }
    });
  }

  delete(el: any) {

    this.dialog.open(ConfirmationDialogComponent, {
      width: '500px',
      data: {
        title: 'Delete type',
        description_extra: `You are deleting the following type: <br/> <span class="fw-bold">${el.type}</span> <br/><br/>This will delete all data associated with your model, including training data. Do you want to continue?`,
        action_btn: 'Delete',
        close_btn: 'Cancel',
        action_btn_color: 'warn',
        bold_description: true,
        extra: {
          details: el.type,
          action: 'confirmInput',
          fieldToBeTypedTitle: `model type name`,
          fieldToBeTypedValue: el.type,
          icon: 'database',
        }
      }
    }).afterClosed().subscribe((result: string) => {
      if (result === 'confirm') {

        this.generalService.showLoading();
        this.machineLearningTrainingService.ml_types_delete(el.type).subscribe({
          next: () => {
    
            this.generalService.showFeedback('Model successfully deleted', 'successMessage');
            this.getModels();
          },
          error: (error: any) => {
    
            this.generalService.showFeedback(error?.error?.message, 'errorMessage', 'Ok');
            this.generalService.hideLoading();
          }
        });
      }
    });
  }

  embed(el: any) {

    this.dialog
      .open(MachineLearningEmbedUiComponent, {
        width: '80vw',
        maxWidth: '850px',
        data: {
          type: el.type,
          noClose: true,
          model: el.model,
        }
      });
  }

  /*
   * Private helper methods.
   */

  private getModels(count: boolean = true) {

    this.generalService.showLoading();
    this.machineLearningTrainingService.ml_types(this.filter).subscribe({
      next: (types: any[]) => {

        this.types = types || [];
        if (!count) {
          this.generalService.hideLoading();
          return;
        }

        const countFilter: any = {};
        for (const idx in this.filter) {
          if (idx !== 'limit' && idx !== 'offset' && idx !== 'order' && idx !== 'direction') {
            countFilter[idx] = this.filter[idx];
          }
        }
        this.machineLearningTrainingService.ml_types_count(countFilter).subscribe({
          next: (result: Count) => {

            this.count = result.count;
            this.generalService.hideLoading();
          },
          error: (error: any) => {

            this.generalService.showFeedback(error?.error?.message, 'errorMessage', 'Ok');
            this.generalService.hideLoading();
          }
        });
      },
      error: (error: any) => {

        this.generalService.showFeedback(error?.error?.message, 'errorMessage', 'Ok');
        this.generalService.hideLoading();
      }
    });
  }

  private getConfiguredStatus() {

    this.openAIService.isConfigured().subscribe({
      next: (result: { result: boolean }) => {

        if (!result.result) {
          this.isLoadingKey = false;
          this.generalService.hideLoading();
          return;
        }
        this.isConfigured = true;
        this.isConfiguredChange.emit(this.isConfigured);
        this.getModels();
      },
      error: (error: any) => {

        this.generalService.showFeedback(error?.error?.message, 'errorMessage', 'Ok');
        this.generalService.hideLoading();
      }
    });
  }
}
