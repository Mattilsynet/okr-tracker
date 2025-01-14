<template>
  <div v-if="resultIndicators.length" class="dashboardResultIndicatorsSection">
    <div class="dashboardResultIndicatorsSection__header">
      <tab-list
        ref="tabList"
        aria-label="Velg resultatindikator"
        :tabs="
          resultIndicators.map((resultIndicator) => ({
            tabName: resultIndicator.name,
            tooltip: {
              content: resultIndicator.description,
              placement: 'bottom',
            },
          }))
        "
        :active-tab="activeTab"
        :set-active-tab="setActiveTab"
        :tab-ids="tabIds"
        :is-filled="false"
      />
      <div class="graphOptions">
        <div class="dropdownButton">
          <v-select
            label="label"
            class="download"
            :value="downloadOption"
            :options="downloadOptions"
            :components="{ OpenIndicator: downloadIcon, Deselect: null }"
            :close-on-select="true"
            @input="download"
          >
          </v-select>
        </div>
      </div>
    </div>
    <tab-panel :active-tab="activeTab" :tab-ids="tabIds">
      <!-- xmlns for download purposes -->
      <svg
        ref="progressGraphSvg"
        class="progressGraph"
        xmlns="http://www.w3.org/2000/svg"
      />

      <div class="progressGraph__footer">
        <dashboard-result-indicator-statistics
          v-if="activeResultIndicator"
          :result-indicator="activeResultIndicator"
          :progress="filteredProgressSorted"
          :goal="goal"
        />

        <router-link
          v-if="activeResultIndicator"
          :to="{
            name: 'KpiHome',
            params: {
              slug: activeResultIndicator.parent.slug,
              kpiId: activeResultIndicator.id,
            },
          }"
          class="btn btn--ter btn--icon"
        >
          {{ $t('btn.moreDetails') }} <i class="icon fa fa-fw fa-chevron-right" />
        </router-link>
      </div>
    </tab-panel>
  </div>
  <empty-state
    v-else
    :icon="'exclamation'"
    :heading="$t('empty.noResultIndicators.heading')"
    :body="$t('empty.noResultIndicators.body')"
  >
    <router-link
      v-if="hasEditRights"
      :to="{ name: 'ItemAdmin', query: { tab: 'kpi' } }"
      class="btn btn--ter"
    >
      {{ $t('empty.noResultIndicators.linkText') }}
    </router-link>
  </empty-state>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import { max, min } from 'd3-array';
import { csvFormatBody, csvFormatRow } from 'd3-dsv';
import firebase from 'firebase/app';
import { db } from '@/config/firebaseConfig';
import { PktIcon } from '@oslokommune/punkt-vue2';
import { periodDates } from '@/util';
import { kpiInterval } from '@/util/kpiHelpers';
import downloadFile from '@/util/downloadFile';
import downloadPng from '@/util/downloadPng';
import LineChart from '@/util/LineChart';
import tabIdsHelper from '@/util/tabUtils';
import i18n from '@/locale/i18n';
import getPeriods from '@/config/periods';
import DashboardResultIndicatorStatistics from './DashboardResultIndicatorStatistics.vue';
import TabList from './TabList.vue';
import TabPanel from './TabPanel.vue';
import EmptyState from './EmptyState.vue';

const { Timestamp } = firebase.firestore;

export default {
  name: 'DashboardResultIndicatorsSection',

  components: {
    TabList,
    TabPanel,
    EmptyState,
    DashboardResultIndicatorStatistics,
  },

  data: () => ({
    activeTab: 0,
    activeResultIndicator: null,
    graph: null,
    downloadOption: '',
    progressCollection: [],
    goals: [],
    startDate: null,
    endDate: null,
    downloadIcon: {
      render: (createElement) => createElement(PktIcon, { props: { name: 'download' } }),
    },
    downloadOptions: [
      {
        label: i18n.t('dashboard.downloadOptions.png'),
        downloadOption: 'png',
      },
      {
        label: i18n.t('dashboard.downloadOptions.csv'),
        downloadOption: 'csv',
      },
    ],
  }),

  computed: {
    ...mapState(['kpis', 'subKpis', 'selectedPeriod']),
    ...mapGetters(['hasEditRights']),
    tabIds() {
      return tabIdsHelper('resultIndicator');
    },
    resultIndicators() {
      return [
        ...this.kpis.filter((kpi) => kpi.kpiType === 'ri'),
        ...this.subKpis.filter((kpi) => kpi.kpiType === 'ri'),
      ];
    },
    goal() {
      // Firebase doesn't support equality filtering on more than one field at
      // a time, so do the rest of the filtering client side.
      const goals = this.goals.filter(
        (goal) =>
          goal.toDate.toDate() > this.startDate && goal.fromDate.toDate() < this.endDate
      );

      // We don't enforce non-overlapping goals (yet?), but if anyone has set
      // overlapping goals, just pick the one with the closest end date.
      return goals ? goals[0] : null;
    },
    filteredProgress() {
      // Filter out any duplicate measurement values for each date
      const seenDates = [];

      return this.progressCollection.filter((a) => {
        const date = a.timestamp.toDate().toISOString().slice(0, 10);
        if (!seenDates.includes(date)) {
          seenDates.push(date);

          const { startDate, endDate } = this.selectedPeriod;

          return (
            (!startDate || a.timestamp.toDate() > startDate) &&
            (!endDate || a.timestamp.toDate() < endDate)
          );
        }
        return false;
      });
    },
    filteredProgressSorted() {
      return this.filteredProgress
        .slice()
        .sort((a, b) => (a.timestamp.toDate() > b.timestamp.toDate() ? 1 : -1));
    },
  },

  watch: {
    activeResultIndicator() {
      Promise.all([this.fetchGoals(), this.setProgress()]).then(() => {
        this.setStartAndEndDates();
        this.renderGraph();
      });
    },

    selectedPeriod() {
      Promise.all([this.fetchGoals(), this.setProgress()]).then(() => {
        this.setStartAndEndDates();
        this.renderGraph();
      });
    },

    resultIndicators() {
      if (this.resultIndicators.length) {
        if (this.activeResultIndicator) {
          // Change to new tab if the active result indicator changes position
          // within the result indicators array.
          const activeResultIndicatorIndex = this.resultIndicators.findIndex(
            (ri) => ri.id === this.activeResultIndicator.id
          );
          if (activeResultIndicatorIndex !== -1) {
            this.setActiveTab(activeResultIndicatorIndex);
            return;
          }
        }
      } else {
        this.graph = null;
        this.activeResultIndicator = null;
      }

      this.setActiveTab(0);
    },
  },

  mounted() {
    this.activeResultIndicator = this.resultIndicators[this.activeTab];
  },

  methods: {
    async setProgress() {
      if (this.activeResultIndicator) {
        if (this.activeResultIndicator.progress) {
          const data = JSON.parse(this.activeResultIndicator.progress);

          this.progressCollection = data.map((m) => {
            return {
              timestamp: {
                toDate: () => new Date(m[0]),
              },
              value: m[1],
              comment: m[2],
            };
          });
        } else {
          let query = db.collection(`kpis/${this.activeResultIndicator.id}/progress`);

          if (this.selectedPeriod.startDate) {
            query = query.where('timestamp', '>=', this.selectedPeriod.startDate);
          }

          if (this.selectedPeriod.endDate) {
            query = query.where('timestamp', '<=', this.selectedPeriod.endDate);
          }

          await this.$bind('progressCollection', query.orderBy('timestamp', 'desc'));
        }
      } else {
        this.progressCollection = [];
      }
    },

    setStartAndEndDates() {
      if (this.selectedPeriod?.key === 'all' && !this.progressCollection.length) {
        // Return dates for all year if it's not possible to identify a start
        // or end date due to missing progress data in the current collection.
        const { startDate, endDate } = getPeriods().year;
        this.startDate = startDate;
        this.endDate = endDate;
        return;
      }

      this.startDate = this.getStartDate(this.selectedPeriod, this.progressCollection);
      this.endDate = this.getEndDate(this.selectedPeriod, this.progressCollection);
    },

    async fetchGoals() {
      if (this.activeResultIndicator) {
        await this.$bind(
          'goals',
          db
            .collection(`kpis/${this.activeResultIndicator.id}/goals`)
            .where('archived', '==', false)
            .orderBy('toDate', 'desc')
        );
      }
    },

    renderGraph() {
      if (!this.resultIndicators.length || !this.activeResultIndicator) {
        return;
      }

      if (!this.graph) {
        this.graph = new LineChart(this.$refs.progressGraphSvg, {
          height: 550,
          legend: true,
          tooltips: true,
        });
      }

      const kpi = this.activeResultIndicator;
      const [startValue, targetValue] = kpiInterval(kpi.format);

      this.graph.render({
        startDate: this.startDate,
        endDate: this.endDate,
        progress: this.filteredProgress,
        targets: this.goals
          .map((g) => ({
            startDate: g.fromDate.toDate(),
            endDate: g.toDate.toDate(),
            value: parseFloat(g.value),
          }))
          .filter((g) => g.endDate >= this.startDate && g.startDate <= this.endDate),
        kpi,
        startValue,
        targetValue,
      });
    },

    download(value) {
      if (!this.activeResultIndicator) {
        return;
      }
      const filename = this.activeResultIndicator.name;

      if (value.downloadOption === 'png') {
        const svgRef = this.$refs.progressGraphSvg;
        const activeTabName = this.$refs.tabList.$el.querySelector(
          `#resultIndicatorTabButton-${this.activeTab}`
        )?.innerText;
        const formattedPeriod = periodDates({
          startDate: this.getStartDate(this.selectedPeriod, this.filteredProgress),
          endDate: this.getEndDate(this.selectedPeriod, this.filteredProgress),
        });

        downloadPng(svgRef, filename, activeTabName, formattedPeriod);
      } else if (value.downloadOption === 'csv') {
        const content = [
          csvFormatRow([
            i18n.t('fields.value'),
            i18n.t('fields.date'),
            i18n.t('fields.comment'),
          ]),
          csvFormatBody(
            this.filteredProgress.map((d) => [
              d.value,
              d.timestamp.toDate().toISOString(),
              d.comment,
            ])
          ),
        ].join('\n');
        downloadFile(content, filename, '.csv');
      }
    },

    setActiveTab(tabIndex) {
      this.activeTab = tabIndex;
      this.activeResultIndicator = this.resultIndicators[tabIndex];
    },

    /**
     * Return the start date of `period`. If unset, the earliest date
     * found in `progress` is returned instead.
     */
    getStartDate(period, progress) {
      if (period.startDate) {
        const ts = Timestamp.fromDate(period.startDate);
        return ts.toDate ? ts.toDate() : new Date(period.ts);
      }

      return min(progress, (d) => d.timestamp.toDate());
    },

    /**
     * Return the end date of `period`. If unset, the last date found in
     * `progress` is returned instead.
     */
    getEndDate(period, progress) {
      if (period.endDate) {
        const ts = Timestamp.fromDate(period.endDate);
        return ts.toDate ? ts.toDate() : new Date(ts);
      }

      return max(progress, (d) => d.timestamp.toDate());
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/styles/typography';

.dashboardResultIndicatorsSection {
  background: var(--color-white);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1.5rem 0.5rem 1.5rem;
    border-bottom: 1px solid var(--color-grayscale-10);

    .title-3 {
      color: var(--color-text);
    }

    .v-select {
      display: inline-flex;
    }

    &::v-deep .vs__dropdown-toggle {
      border-color: var(--color-grayscale-10);

      &:hover {
        background: var(--color-gray-light);
        border-color: var(--color-gray-light);
        cursor: pointer;
      }

      .vs__open-indicator {
        height: 1.25rem;
        margin: 0.15rem 0.4rem 0.3rem 0.2rem;
        padding: 0rem;
      }

      .vs__search {
        padding: 0rem;
      }
    }

    &::v-deep .vs__dropdown-menu {
      border: 1px solid var(--color-grayscale-10);
    }

    .graphOptions {
      display: flex;
      gap: 0.5rem;
      justify-content: space-between;
      margin-left: 1rem;
    }

    .download {
      min-width: 1rem;
      height: 100%;
      margin-right: 0.5rem;

      &::v-deep .vs__dropdown-menu {
        left: -3.6rem;
        border: 1px solid var(--color-grayscale-10);
      }
    }

    .dropdownButton {
      display: inline-block;

      &::v-deep .vs--open .vs__open-indicator {
        transform: rotate(0deg) scale(1);
      }
    }
  }
}

.progressGraph {
  padding: 1rem 1rem 0 0.25rem;

  &__footer {
    display: flex;
    gap: 1rem;
    align-items: center;
    min-height: 6rem;
    border-top: 1px solid var(--color-grayscale-10);

    > .progressStatistics {
      flex: 1 1 auto;
    }

    > .btn {
      flex: 0 1 auto;
      margin-right: 1.5rem;
    }
  }
}
</style>
