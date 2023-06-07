import { firestoreAction } from 'vuexfire';
import { db } from '@/config/firebaseConfig';
import getActiveItemType from '@/util/getActiveItemType';

export default firestoreAction(
  async ({ bindFirestoreRef, unbindFirestoreRef }, { periodId, item }) => {
    if (!periodId && !item) {
      unbindFirestoreRef('periods');
      unbindFirestoreRef('objectives');
      unbindFirestoreRef('keyResults');
      unbindFirestoreRef('activePeriod');
      return false;
    }

    let parentRef = null;

    if (periodId) {
      const activePeriodRef = db.collection('periods').doc(periodId);
      await bindFirestoreRef('activePeriod', activePeriodRef, { maxRefDepth: 0 });
      parentRef = await activePeriodRef.get().then((snapshot) => snapshot.data().parent);
    } else {
      const itemType = getActiveItemType(item);
      parentRef = db.collection(`${itemType}s`).doc(item.id);
    }

    const objectivesRef = db
      .collection('objectives')
      .where('archived', '==', false)
      .where('parent', '==', parentRef)
      .orderBy('name');

    const activeObjectivesList = await objectivesRef
      .get()
      .then((snapshot) => snapshot.docs.map((doc) => doc.ref));

    if (activeObjectivesList.length) {
      const keyResultsRef = db
        .collection('keyResults')
        .where('archived', '==', false)
        .where('parent', '==', parentRef)
        .orderBy('name');

      await bindFirestoreRef('objectives', objectivesRef, { maxRefDepth: 1 });
      await bindFirestoreRef('keyResults', keyResultsRef, { maxRefDepth: 0 });
    } else {
      unbindFirestoreRef('objectives');
      unbindFirestoreRef('keyResults');
    }

    return true;
  }
);
