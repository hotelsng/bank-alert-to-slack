<?php namespace App\Http\Controller; 

use App\Alert;

class AlertLoggerController extends Controller {

    public function logAlert() {
        $post = (array) request()->get('data');

        $upsertedAlerts = [];

        for ($i = 0; $i < count($post); $i++) {
            $alert = $post[$i];

            $alert["created_on"] = strtotime(trim($alert["created_on"])); 

            $alertObject = Alert::firstOrNew([
                "google_email_id" => $alert['google_email_id']
            ]);

            if( ! $alertObject->exists) {
                $response = $alertObject->create($alert);

                array_push($upsertedAlerts, $response);
            }
        }

        return $upsertedAlerts;
    }
}
