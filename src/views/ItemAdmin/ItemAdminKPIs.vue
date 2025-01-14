<template>
  <div v-if="kpis.length">
    <button class="btn btn--ghost" :disabled="loading" @click="createKpi">
      {{ $t('kpi.add') }}
    </button>

    <div class="kpis">
      <ItemAdminKPI
        v-for="kpi in orderedKpis"
        :key="kpi.id"
        :kpi="kpi"
        :visible="selectedKpiId === kpi.id"
        @toggle="kpiToggled"
        @hook:mounted="kpiMounted(kpi.id)"
      />
    </div>
  </div>

  <empty-state
    v-else
    :icon="'lightbulb'"
    :heading="$t('empty.noKPIs.heading')"
    :body="$t('empty.noKPIs.adminBody')"
  >
    <button class="btn btn--ter" :disabled="loading" @click="createKpi">
      {{ $t('kpi.add') }}
    </button>
  </empty-state>
</template>

<script>
import { mapState } from 'vuex';
import Kpi from '@/db/Kpi';

export default {
  name: 'ItemAdminKPIs',

  components: {
    EmptyState: () => import('@/components/EmptyState.vue'),
    ItemAdminKPI: () => import('@/views/ItemAdmin/ItemAdminKPI.vue'),
  },

  data: () => ({
    selectedKpiId: null,
    loading: false,
  }),

  computed: {
    ...mapState(['kpis', 'activeItemRef']),

    orderedKpis() {
      const kpiOrder = ['ri', 'keyfig', 'plain'];
      return this.kpis
        .map((x) => x)
        .sort((a, b) => a.name.localeCompare(b.name))
        .sort((a, b) => kpiOrder.indexOf(a.kpiType) - kpiOrder.indexOf(b.kpiType));
    },
  },

  watch: {
    '$route.query': {
      immediate: true,
      async handler(query) {
        this.selectedKpiId = query?.id;
      },
    },

    async selectedKpiId(kpiId) {
      const query = { tab: 'kpi', id: !kpiId ? undefined : kpiId };
      if (this.$route.query?.id !== query.id) {
        await this.$router.push({ query });
      }
    },
  },

  mounted() {
    const { query } = this.$route;
    const queriedKpiId = query?.id;
    if (queriedKpiId && this.kpis.map((kpi) => kpi.id).includes(queriedKpiId)) {
      this.selectedKpiId = queriedKpiId;
    }
  },

  methods: {
    async createKpi() {
      this.loading = true;

      const data = {
        parent: this.activeItemRef,
        name: this.$t('kpi.placeholderName'),
        description: '',
        format: 'integer',
        preferredTrend: 'increase',
        kpiType: 'plain',
        updateFrequency: 'daily',
        sheetUrl: '',
        sheetName: '',
        sheetCell: '',
        api: true,
        auto: false,
      };

      try {
        const KpiRef = await Kpi.create(data);
        this.$toasted.show(this.$t('toaster.add.kpi'));
        this.selectedKpiId = KpiRef.id;
      } catch (error) {
        console.log(error);
        this.$toasted.error(this.$t('toaster.error.kpi'));
        throw new Error(error);
      } finally {
        this.loading = false;
        this.scrollToKpi(this.selectedKpiId);
      }
    },

    scrollToKpi(kpiId) {
      this.$nextTick(() => {
        const kpiEl = document.getElementById(kpiId);
        if (kpiEl) {
          const bounds = kpiEl.getBoundingClientRect();
          window.scrollTo({ top: bounds.top, behavior: 'smooth' });
        }
      });
    },

    kpiToggled(open, kpi) {
      if (open) {
        this.selectedKpiId = kpi.id;
      } else if (this.selectedKpiId === kpi.id) {
        this.selectedKpiId = null;
      }
    },

    kpiMounted(kpiId) {
      if (kpiId === this.selectedKpiId) {
        this.scrollToKpi(kpiId);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.kpis {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 1.5rem 0;

  @media screen and (min-width: bp(l)) {
    width: span(6, 0, span(8));
  }
}
</style>
