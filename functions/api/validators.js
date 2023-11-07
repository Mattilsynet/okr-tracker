import validator from 'express-validator';

const { body, header, param, oneOf } = validator;

// Allow usage of the `okr-team-secret` header for now, until
// all existing clients are migrated.
export const clientSecretValidator = oneOf(
  [
    header('okr-team-secret')
      .not()
      .isEmpty()
      .withMessage('The `okr-team-secret` header is required'),
    [
      header('okr-client-id')
        .not()
        .isEmpty()
        .withMessage('The `okr-client-id` header is required'),
      header('okr-client-secret')
        .not()
        .isEmpty()
        .withMessage('The `okr-client-secret` header is required'),
    ],
  ],
  {
    message:
      'A pair of `okr-client-id`/`okr-client-secret` headers or an `okr-team-secret` header is required',
  }
);

export const adminSecretValidator = header('okr-admin-secret')
  .not()
  .isEmpty()
  .withMessage('The `okr-admin-secret` header is required');

export const idValidator = param('id').trim().escape();

export const dateValidator = param('date')
  .trim()
  .isDate()
  .escape()
  .toDate()
  .custom((date) => {
    if (date.getTime() > new Date().getTime()) {
      throw new Error('Future dates not allowed');
    }
    return true;
  });

const checkMeasurementValue = (field) =>
  field
    .not()
    .isEmpty()
    .withMessage('Required field')
    .isFloat({ min: 0 })
    .escape()
    .toFloat();

export const progressValidator = checkMeasurementValue(body('progress'));
export const valueValidator = checkMeasurementValue(body('value'));

export const commentValidator = body('comment').trim().escape();

export const displayNameValidator = body('displayName').trim().escape();

export const positionValidator = body('position').trim().escape();
